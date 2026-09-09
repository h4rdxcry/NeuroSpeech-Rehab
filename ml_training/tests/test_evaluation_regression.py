"""Regression checks for interpretable ASR evaluation, using only tiny synthetic tensors."""
from types import SimpleNamespace
import pytest
import torch
from ml_training.trainer import Wav2Vec2CTCTrainer
from ml_training.tokenizer import TamilTokenizer

class Model(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.wav2vec2 = SimpleNamespace(_get_feat_extract_output_lengths=lambda n: n)
    def forward(self, values, attention_mask):
        assert attention_mask.tolist() == [[1,1,1,1],[1,1,0,0]]
        # First output is 'll'; second is 'a' plus padding that must not count.
        ids = torch.tensor([[1,0,1,0],[2,0,1,1]])
        return torch.nn.functional.one_hot(ids, num_classes=3).float()*20

def trainer():
    t = Wav2Vec2CTCTrainer.__new__(Wav2Vec2CTCTrainer)
    t.config = SimpleNamespace(device='cpu', max_audio_length_seconds=4, target_sample_rate=1)
    t.model = Model()
    t.tokenizer = TamilTokenizer(); t.tokenizer.char_to_idx={'<blank>':0,'l':1,'a':2}; t.tokenizer.idx_to_char={0:'<blank>',1:'l',2:'a'}
    return t

def batch():
    return {'input_values':torch.zeros(2,4),'input_lengths':torch.tensor([4,2]),'labels':torch.tensor([1,1,2]),'label_lengths':torch.tensor([2,1]),'transcripts':['ll','a']}

def test_original_repeated_reference_characters_and_padding_are_preserved():
    result=trainer().evaluate([batch()])
    assert result['cer'] == 0 and result['wer'] == 0

def test_attention_mask_counts_real_samples_even_when_audio_is_zero():
    assert trainer()._build_attention_mask(torch.zeros(2,4),torch.tensor([4,2])).tolist()==[[1,1,1,1],[1,1,0,0]]

def test_missing_references_and_empty_population_are_errors():
    b=batch();b.pop('transcripts')
    with pytest.raises(ValueError,match='original'):trainer().evaluate([b])
    with pytest.raises(ValueError,match='at least one'):trainer().evaluate([])

def test_long_audio_cannot_silently_truncate_against_full_reference():
    b=batch();b['input_values']=torch.zeros(2,5)
    with pytest.raises(ValueError,match='duration'):trainer().evaluate([b])
