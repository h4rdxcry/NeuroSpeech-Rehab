-- NeuroSpeech Rehabilitation Platform - Cloud PostgreSQL / Supabase Schema
-- Target: Supabase / PostgreSQL 15+
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS exercises (
	id UUID NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	description TEXT, 
	exercise_type VARCHAR(64) NOT NULL, 
	target_modalities JSON NOT NULL, 
	difficulty VARCHAR(32) NOT NULL, 
	duration_seconds INTEGER, 
	repetition_count INTEGER, 
	configuration JSON, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS modalities (
	id UUID NOT NULL, 
	name VARCHAR(64) NOT NULL, 
	description TEXT, 
	required_for_sync BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS roles (
	id UUID NOT NULL, 
	name VARCHAR(50) NOT NULL, 
	permissions VARCHAR NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
	PRIMARY KEY (id), 
	UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS users (
	id UUID NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	role_id UUID NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(role_id) REFERENCES roles (id)
);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE IF NOT EXISTS audit_logs (
	id UUID NOT NULL, 
	user_id UUID, 
	actor_role VARCHAR(64), 
	action VARCHAR(64) NOT NULL, 
	resource_type VARCHAR(64) NOT NULL, 
	resource_id UUID, 
	request_id VARCHAR(255), 
	result VARCHAR(32) NOT NULL, 
	ip_address VARCHAR(64), 
	user_agent TEXT, 
	log_metadata JSON, 
	timestamp TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS datasets (
	id UUID NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	version VARCHAR(64) NOT NULL, 
	description TEXT, 
	bids_root TEXT, 
	participant_ids JSON NOT NULL, 
	recording_ids JSON NOT NULL, 
	split_definition JSON NOT NULL, 
	is_final_test BOOLEAN NOT NULL, 
	is_locked BOOLEAN NOT NULL, 
	created_by UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	source_organization VARCHAR(255), 
	source_url TEXT, 
	citation TEXT, 
	modality VARCHAR(64), 
	population_description TEXT, 
	participant_count INTEGER, 
	recording_count INTEGER, 
	total_duration FLOAT, 
	sampling_information TEXT, 
	file_format VARCHAR(64), 
	license VARCHAR(255), 
	access_type VARCHAR(64), 
	access_requirements TEXT, 
	consent_ethics TEXT, 
	clinical_or_control_population VARCHAR(64), 
	language VARCHAR(64), 
	task_description TEXT, 
	acquisition_device VARCHAR(255), 
	is_public BOOLEAN NOT NULL, 
	is_restricted BOOLEAN NOT NULL, 
	is_credentialed BOOLEAN NOT NULL, 
	imported_status VARCHAR(32) NOT NULL, 
	import_date TIMESTAMP WITH TIME ZONE, 
	checksum VARCHAR(255), 
	data_classification VARCHAR(32) NOT NULL, 
	notes TEXT, 
	manifest JSON, 
	import_error TEXT, 
	qc_status VARCHAR(32), 
	PRIMARY KEY (id), 
	FOREIGN KEY(created_by) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS model_versions (
	id UUID NOT NULL, 
	model_name VARCHAR(255) NOT NULL, 
	version VARCHAR(64) NOT NULL, 
	model_type VARCHAR(64) NOT NULL, 
	architecture_json JSON NOT NULL, 
	training_dataset_version VARCHAR(255) NOT NULL, 
	feature_pipeline_version VARCHAR(255) NOT NULL, 
	training_params JSON, 
	performance_metrics JSON, 
	is_production BOOLEAN NOT NULL, 
	is_archived BOOLEAN NOT NULL, 
	registered_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	registered_by UUID NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(registered_by) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS research_participants (
	id UUID NOT NULL, 
	pseudonym_id VARCHAR(64) NOT NULL, 
	demographic_summary VARCHAR, 
	inclusion_criteria VARCHAR, 
	exclusion_criteria VARCHAR, 
	consent_status VARCHAR(32) NOT NULL, 
	consent_date DATE, 
	assigned_clinician_id UUID, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(assigned_clinician_id) REFERENCES users (id)
);

CREATE UNIQUE INDEX ix_research_participants_pseudonym_id ON research_participants (pseudonym_id);

CREATE TABLE IF NOT EXISTS dataset_catalog (
	id UUID NOT NULL, 
	dataset_id UUID NOT NULL, 
	modality VARCHAR(64), 
	source VARCHAR(255), 
	version VARCHAR(64), 
	participants INTEGER, 
	recordings INTEGER, 
	duration FLOAT, 
	population VARCHAR(255), 
	clinical_control VARCHAR(64), 
	license VARCHAR(255), 
	access_requirements TEXT, 
	project_usage VARCHAR(32), 
	citation TEXT, 
	url TEXT, 
	notes TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (dataset_id), 
	FOREIGN KEY(dataset_id) REFERENCES datasets (id)
);

CREATE TABLE IF NOT EXISTS dataset_import_logs (
	id UUID NOT NULL, 
	dataset_id UUID NOT NULL, 
	status VARCHAR(32) NOT NULL, 
	message TEXT, 
	metadata JSON, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(dataset_id) REFERENCES datasets (id)
);

CREATE INDEX IF NOT EXISTS ix_dataset_import_logs_dataset_id ON dataset_import_logs (dataset_id);

CREATE TABLE IF NOT EXISTS dataset_provenance (
	id UUID NOT NULL, 
	dataset_id UUID NOT NULL, 
	original_source VARCHAR(255) NOT NULL, 
	original_dataset_identifier VARCHAR(255), 
	version VARCHAR(64), 
	download_timestamp TIMESTAMP WITH TIME ZONE, 
	source_url TEXT, 
	license_access_info TEXT, 
	checksum VARCHAR(255), 
	preprocessing_pipeline_version VARCHAR(255), 
	transformations_performed TEXT, 
	responsible_user_id UUID, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (dataset_id), 
	FOREIGN KEY(dataset_id) REFERENCES datasets (id), 
	FOREIGN KEY(responsible_user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS dataset_splits (
	id UUID NOT NULL, 
	dataset_id UUID NOT NULL, 
	participant_id VARCHAR(255) NOT NULL, 
	split_type VARCHAR(32) NOT NULL, 
	split_version VARCHAR(64), 
	is_locked BOOLEAN NOT NULL, 
	final_test_flag BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(dataset_id) REFERENCES datasets (id)
);

CREATE TABLE IF NOT EXISTS evaluation_runs (
	id UUID NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	model_version_id UUID NOT NULL, 
	dataset_version VARCHAR(255) NOT NULL, 
	dataset_split VARCHAR(32) NOT NULL, 
	split_definition JSON NOT NULL, 
	metrics JSON NOT NULL, 
	confusion_matrix JSON, 
	per_participant_metrics JSON, 
	per_exercise_metrics JSON, 
	latency_stats JSON, 
	failure_cases JSON, 
	notes TEXT, 
	run_by UUID NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	completed_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(model_version_id) REFERENCES model_versions (id), 
	FOREIGN KEY(run_by) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS patients (
	id UUID NOT NULL, 
	user_id UUID NOT NULL, 
	participant_id UUID, 
	clinician_id UUID, 
	date_of_birth DATE, 
	notes TEXT, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	UNIQUE (participant_id), 
	FOREIGN KEY(participant_id) REFERENCES research_participants (id), 
	FOREIGN KEY(clinician_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS sessions (
	id UUID NOT NULL, 
	participant_id UUID NOT NULL, 
	patient_id UUID, 
	clinician_id UUID, 
	session_date DATE NOT NULL, 
	session_number INTEGER NOT NULL, 
	protocol_id VARCHAR(255), 
	environment VARCHAR(64), 
	notes TEXT, 
	started_at TIMESTAMP WITH TIME ZONE, 
	ended_at TIMESTAMP WITH TIME ZONE, 
	status VARCHAR(32) NOT NULL, 
	dataset_split VARCHAR(32), 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(participant_id) REFERENCES research_participants (id), 
	FOREIGN KEY(patient_id) REFERENCES patients (id), 
	FOREIGN KEY(clinician_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS recordings (
	id UUID NOT NULL, 
	session_id UUID NOT NULL, 
	session_exercise_id UUID, 
	attempt_id UUID, 
	modality VARCHAR(32) NOT NULL, 
	device_id VARCHAR(255) NOT NULL, 
	device_name VARCHAR(255), 
	file_path TEXT NOT NULL, 
	file_format VARCHAR(32) NOT NULL, 
	sampling_rate_hz FLOAT, 
	channel_count INTEGER, 
	channel_names JSON, 
	duration_seconds FLOAT, 
	start_timestamp TIMESTAMP WITH TIME ZONE NOT NULL, 
	end_timestamp TIMESTAMP WITH TIME ZONE, 
	is_synthetic BOOLEAN NOT NULL, 
	synthetic_source VARCHAR(255), 
	ground_truth_available BOOLEAN NOT NULL, 
	processing_status VARCHAR(32) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	participant_pseudonym VARCHAR(64), 
	session_identifier VARCHAR(255), 
	recording_identifier VARCHAR(255), 
	data_classification VARCHAR(32) NOT NULL, 
	units VARCHAR(64), 
	source_dataset_id UUID, 
	quality_status VARCHAR(32), 
	synchronization_info JSON, 
	PRIMARY KEY (id), 
	FOREIGN KEY(session_id) REFERENCES sessions (id), 
	FOREIGN KEY(source_dataset_id) REFERENCES datasets (id)
);

CREATE TABLE IF NOT EXISTS session_exercises (
	id UUID NOT NULL, 
	session_id UUID NOT NULL, 
	exercise_id UUID NOT NULL, 
	order_index INTEGER NOT NULL, 
	status VARCHAR(32) NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE, 
	ended_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(session_id) REFERENCES sessions (id), 
	FOREIGN KEY(exercise_id) REFERENCES exercises (id)
);

CREATE TABLE IF NOT EXISTS annotations (
	id UUID NOT NULL, 
	recording_id UUID NOT NULL, 
	annotator_id UUID NOT NULL, 
	annotation_type VARCHAR(64) NOT NULL, 
	start_timestamp TIMESTAMP WITH TIME ZONE NOT NULL, 
	end_timestamp TIMESTAMP WITH TIME ZONE, 
	label TEXT NOT NULL, 
	confidence FLOAT, 
	notes TEXT, 
	is_ground_truth BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(recording_id) REFERENCES recordings (id), 
	FOREIGN KEY(annotator_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS attempts (
	id UUID NOT NULL, 
	session_exercise_id UUID NOT NULL, 
	attempt_number INTEGER NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	ended_at TIMESTAMP WITH TIME ZONE, 
	outcome VARCHAR(64), 
	clinician_rating INTEGER, 
	notes TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(session_exercise_id) REFERENCES session_exercises (id)
);

CREATE TABLE IF NOT EXISTS feature_records (
	id UUID NOT NULL, 
	recording_id UUID NOT NULL, 
	pipeline_version VARCHAR(64) NOT NULL, 
	source_sha256 VARCHAR(64) NOT NULL, 
	result JSON NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_feature_recording_pipeline UNIQUE (recording_id, pipeline_version), 
	FOREIGN KEY(recording_id) REFERENCES recordings (id)
);

CREATE TABLE IF NOT EXISTS signal_quality (
	id UUID NOT NULL, 
	recording_id UUID NOT NULL, 
	quality_state VARCHAR(32) NOT NULL, 
	quality_score FLOAT, 
	artifact_ratio FLOAT, 
	missing_data_ratio FLOAT, 
	synchronization_status VARCHAR(32), 
	sampling_rate_valid BOOLEAN, 
	channel_status JSON, 
	missing_channels JSON, 
	corrupted_files BOOLEAN, 
	clipping BOOLEAN, 
	artifact_indicators JSON, 
	sampling_problems JSON, 
	synchronization_problems JSON, 
	rejection_reason TEXT, 
	qc_timestamp TIMESTAMP WITH TIME ZONE, 
	notes TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (recording_id), 
	FOREIGN KEY(recording_id) REFERENCES recordings (id)
);

CREATE TABLE IF NOT EXISTS predictions (
	id UUID NOT NULL, 
	attempt_id UUID NOT NULL, 
	recording_id UUID, 
	model_id UUID NOT NULL, 
	model_version VARCHAR(64) NOT NULL, 
	feature_pipeline_version VARCHAR(64) NOT NULL, 
	training_dataset_version VARCHAR(64) NOT NULL, 
	prediction_type VARCHAR(64) NOT NULL, 
	predicted_label VARCHAR(255) NOT NULL, 
	confidence FLOAT, 
	uncertainty FLOAT, 
	prediction_json JSON, 
	signal_quality_state VARCHAR(64) NOT NULL, 
	signal_quality_details JSON, 
	timestamp TIMESTAMP WITH TIME ZONE NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(attempt_id) REFERENCES attempts (id), 
	FOREIGN KEY(model_id) REFERENCES model_versions (id)
);
