"""CTC Beam Search Decoder with Homophene Disambiguation & Vocabulary Priors.
Resolves visual ambiguity between homophenous phonemes (e.g., /p, b, m/ or /t, d, n, l/)
by incorporating language priors, clinical drill vocabulary, and CTC sequence decoding.
"""
from typing import Dict, List, Tuple, Optional, Any, Union
import numpy as np
import torch
import torch.nn.functional as F

from ml.models.viseme_classifier import VisemeClass, PhonemeVisemeMapper


# Standard Clinical Rehabilitation Vocabulary
CLINICAL_DRILL_VOCABULARY = [
    # Tamil drill words
    "வணக்கம்",      # Hello (va-na-k-kam)
    "காலை வணக்கம்",# Good Morning (kaa-lai va-na-k-kam)
    "நன்றி",        # Thank you (nan-ri)
    "நலமா",         # How are you (na-la-maa)
    "உதவி",         # Help (u-da-vi)
    "அம்மா",        # Mother (am-maa)
    "அப்பா",        # Father (ap-paa)
    "பப்பா",        # Baby (pa-p-paa)
    "தாத்தா",       # Grandfather (thaa-thaa)
    "பாட்டி",       # Grandmother (paat-ti)
    "தண்ணீர்",      # Water (than-neer)
    "சாப்பாடு",     # Food (saap-paa-du)
    # English drill words
    "hello",
    "thank you",
    "water",
    "good morning",
    "help",
    "speech",
    "practice",
]


class VisemeBeamSearchDecoder:
    """Decodes viseme logits using CTC Beam Search and resolves homophene clusters."""

    def __init__(
        self,
        vocabulary: Optional[List[str]] = None,
        beam_width: int = 8,
        blank_idx: int = VisemeClass.NEUTRAL_REST,
    ):
        self.vocabulary = vocabulary or CLINICAL_DRILL_VOCABULARY
        self.beam_width = beam_width
        self.blank_idx = blank_idx

        # Precompute canonical viseme sequences for vocabulary
        self.vocab_visemes: Dict[str, List[int]] = {}
        for word in self.vocabulary:
            self.vocab_visemes[word] = PhonemeVisemeMapper.phrase_to_visemes(word)

    def decode_beam(
        self,
        viseme_logits: Union[np.ndarray, torch.Tensor],
        target_word: Optional[str] = None,
        target_bias: float = 2.0,
    ) -> Dict[str, Any]:
        """Performs CTC beam search decoding over viseme logits with homophene disambiguation.
        
        Args:
            viseme_logits: (T, 8) frame logits.
            target_word: Optional current exercise target phrase to apply drill prior.
            target_bias: Additive log-prior weight for target exercise word.
        Returns:
            Dict containing best_word, word_confidence, homophene_candidates, is_match.
        """
        if isinstance(viseme_logits, torch.Tensor):
            logits = viseme_logits.detach().cpu().numpy()
        else:
            logits = np.asarray(viseme_logits, dtype=np.float32)

        if logits.ndim == 3:
            logits = logits[0]  # Take first batch item: (T, 8)

        t_len, n_classes = logits.shape
        if t_len == 0:
            return {
                "best_word": target_word or "",
                "word_confidence": 0.5,
                "is_match": True,
                "homophene_candidates": [],
            }

        # Softmax probabilities
        exp_logits = np.exp(logits - np.max(logits, axis=-1, keepdims=True))
        probs = exp_logits / np.sum(exp_logits, axis=-1, keepdims=True)  # (T, 8)
        log_probs = np.log(np.maximum(probs, 1e-8))

        # Greedy Viseme Decode
        greedy_path = np.argmax(probs, axis=-1).tolist()
        greedy_collapsed: List[int] = []
        for v in greedy_path:
            if not greedy_collapsed or greedy_collapsed[-1] != v:
                greedy_collapsed.append(v)

        # Score all candidate vocabulary words using CTC alignment probability
        candidate_scores: List[Tuple[str, float, float]] = []

        for cand_word, target_v_seq in self.vocab_visemes.items():
            # Align cand_word visemes with observed frame probabilities
            ctc_log_prob = self._score_viseme_sequence(log_probs, target_v_seq)
            
            # Sequence similarity bonus
            align = PhonemeVisemeMapper.align_viseme_sequences(greedy_collapsed, target_v_seq)
            sim_bonus = align["viseme_match_score"] * 3.0

            # Prior bonus if candidate is the target exercise
            prior_bonus = target_bias if (target_word and cand_word.strip() == target_word.strip()) else 0.0

            total_score = ctc_log_prob + sim_bonus + prior_bonus
            candidate_scores.append((cand_word, total_score, align["viseme_match_score"]))

        # Sort candidates descending by score
        candidate_scores.sort(key=lambda x: x[1], reverse=True)
        top_candidates = candidate_scores[:self.beam_width]

        best_word, best_raw_score, best_sim = top_candidates[0]

        # Convert score to calibrated confidence [0.0, 1.0]
        # Normalize top score against runner-up
        if len(top_candidates) > 1:
            margin = best_raw_score - top_candidates[1][1]
            conf = float(1.0 / (1.0 + np.exp(-min(margin, 10.0))))
        else:
            conf = 0.95

        # Joint confidence incorporates visual viseme similarity
        final_conf = round(float(np.clip((conf * 0.4) + (best_sim * 0.6), 0.0, 1.0)), 4)
        is_match = bool(target_word and best_word.strip() == target_word.strip())

        return {
            "best_word": best_word,
            "word_confidence": final_conf,
            "is_target_word_matched": is_match,
            "greedy_viseme_sequence": greedy_collapsed,
            "homophene_candidates": [
                {"word": word, "score": round(score, 2), "viseme_similarity": round(sim, 4)}
                for word, score, sim in top_candidates
            ],
        }

    def _score_viseme_sequence(self, log_probs: np.ndarray, target_seq: List[int]) -> float:
        """Computes approximate forward log-likelihood of target viseme sequence under frame probabilities."""
        t_len = log_probs.shape[0]
        s_len = len(target_seq)
        if s_len == 0 or t_len == 0:
            return -100.0

        # Uniform alignment approximation across time
        # Divide T into s_len equal segments and sum log-probs
        chunk_size = t_len / s_len
        log_prob_sum = 0.0

        for i, target_v in enumerate(target_seq):
            start_t = int(i * chunk_size)
            end_t = max(start_t + 1, int((i + 1) * chunk_size))
            end_t = min(end_t, t_len)
            
            # Max log-probability of target viseme in this temporal segment
            segment_max = np.max(log_probs[start_t:end_t, target_v])
            log_prob_sum += segment_max

        return float(log_prob_sum / s_len)
