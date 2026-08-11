"""Initial schema — explicit Alembic operations.

Revision ID: 001
Revises:
Create Date: 2026-08-07
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
CREATE TABLE app_settings (
	id UUID NOT NULL, 
	category VARCHAR(50) NOT NULL, 
	value_json JSONB NOT NULL, 
	updated_by_user_id UUID, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
)
    """)
    op.execute("""
CREATE TABLE audit_logs (
	id UUID NOT NULL, 
	user_id UUID, 
	user_name VARCHAR(200) NOT NULL, 
	action VARCHAR(100) NOT NULL, 
	entity_type VARCHAR(50) NOT NULL, 
	entity_id VARCHAR(64) NOT NULL, 
	result VARCHAR(20) NOT NULL, 
	ip_address VARCHAR(64), 
	user_agent VARCHAR(500), 
	request_id VARCHAR(64), 
	details TEXT NOT NULL, 
	details_json JSONB, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
)
    """)
    op.execute("""
CREATE TABLE email_templates (
	id UUID NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	slug VARCHAR(150) NOT NULL, 
	subject VARCHAR(255) NOT NULL, 
	body_html TEXT NOT NULL, 
	body_text TEXT NOT NULL, 
	language VARCHAR(10) NOT NULL, 
	variables_json JSONB, 
	enabled BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (slug)
)
    """)
    op.execute("""
CREATE TABLE faq_entries (
	id UUID NOT NULL, 
	question TEXT NOT NULL, 
	answer TEXT NOT NULL, 
	language VARCHAR(10) NOT NULL, 
	tags VARCHAR(255), 
	confidence_boost FLOAT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
)
    """)
    op.execute("""
CREATE TABLE integration_connections (
	id UUID NOT NULL, 
	provider VARCHAR(50) NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	description TEXT NOT NULL, 
	logo VARCHAR(50) NOT NULL, 
	category VARCHAR(50) NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	configuration_json JSONB, 
	encrypted_credentials TEXT, 
	last_synced_at TIMESTAMP WITH TIME ZONE, 
	last_tested_at TIMESTAMP WITH TIME ZONE, 
	error_message TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
)
    """)
    op.execute("""
CREATE TABLE knowledge_documents (
	id UUID NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	source VARCHAR(255), 
	language VARCHAR(10) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
)
    """)
    op.execute("""
CREATE TABLE tags (
	id UUID NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	color VARCHAR(20) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (name)
)
    """)
    op.execute("""
CREATE TABLE users (
	id UUID NOT NULL, 
	first_name VARCHAR(100) NOT NULL, 
	last_name VARCHAR(100) NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	phone VARCHAR(50), 
	password_hash VARCHAR(255) NOT NULL, 
	role VARCHAR(50) NOT NULL, 
	status VARCHAR(20) NOT NULL, 
	language VARCHAR(10) NOT NULL, 
	timezone VARCHAR(64) NOT NULL, 
	avatar_url VARCHAR(500), 
	last_login_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id)
)
    """)
    op.execute("""
CREATE TABLE workflows (
	id UUID NOT NULL, 
	name VARCHAR(150) NOT NULL, 
	slug VARCHAR(150) NOT NULL, 
	description TEXT NOT NULL, 
	external_workflow_id VARCHAR(100), 
	status VARCHAR(20) NOT NULL, 
	configuration_json JSONB, 
	last_execution_at TIMESTAMP WITH TIME ZONE, 
	success_count INTEGER NOT NULL, 
	failure_count INTEGER NOT NULL, 
	total_duration_ms INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (slug)
)
    """)
    op.execute("""
CREATE TABLE calendar_connections (
	id UUID NOT NULL, 
	user_id UUID NOT NULL, 
	provider VARCHAR(50) NOT NULL, 
	encrypted_access_token TEXT, 
	encrypted_refresh_token TEXT, 
	token_expires_at TIMESTAMP WITH TIME ZONE, 
	calendar_id VARCHAR(255), 
	email VARCHAR(255), 
	sync_enabled BOOLEAN NOT NULL, 
	last_synced_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)
    """)
    op.execute("""
CREATE TABLE knowledge_chunks (
	id UUID NOT NULL, 
	document_id UUID NOT NULL, 
	content TEXT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(document_id) REFERENCES knowledge_documents (id) ON DELETE CASCADE
)
    """)
    op.execute("""
CREATE TABLE leads (
	id UUID NOT NULL, 
	first_name VARCHAR(100) NOT NULL, 
	last_name VARCHAR(100) NOT NULL, 
	company_name VARCHAR(255) NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	phone VARCHAR(50), 
	country VARCHAR(100) NOT NULL, 
	language VARCHAR(10) NOT NULL, 
	source VARCHAR(50) NOT NULL, 
	service_interest VARCHAR(255) NOT NULL, 
	company_size VARCHAR(50), 
	budget_min FLOAT, 
	budget_max FLOAT, 
	budget_range VARCHAR(100), 
	timeline VARCHAR(100), 
	need_description TEXT NOT NULL, 
	preferred_contact_channel VARCHAR(50), 
	decision_authority VARCHAR(100), 
	estimated_value FLOAT, 
	score INTEGER NOT NULL, 
	temperature VARCHAR(10) NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	priority VARCHAR(20) NOT NULL, 
	assigned_user_id UUID, 
	last_interaction_at TIMESTAMP WITH TIME ZONE, 
	next_follow_up_at TIMESTAMP WITH TIME ZONE, 
	consent_given BOOLEAN NOT NULL, 
	consent_at TIMESTAMP WITH TIME ZONE, 
	archived_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(assigned_user_id) REFERENCES users (id) ON DELETE SET NULL
)
    """)
    op.execute("""
CREATE TABLE notifications (
	id UUID NOT NULL, 
	user_id UUID NOT NULL, 
	category VARCHAR(30) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	message TEXT NOT NULL, 
	entity_type VARCHAR(50), 
	entity_id VARCHAR(64), 
	read_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)
    """)
    op.execute("""
CREATE TABLE password_reset_tokens (
	id UUID NOT NULL, 
	user_id UUID NOT NULL, 
	token_hash VARCHAR(128) NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	used_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)
    """)
    op.execute("""
CREATE TABLE refresh_tokens (
	id UUID NOT NULL, 
	user_id UUID NOT NULL, 
	token_hash VARCHAR(128) NOT NULL, 
	device_info VARCHAR(255), 
	ip_address VARCHAR(64), 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	revoked_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)
    """)
    op.execute("""
CREATE TABLE activities (
	id UUID NOT NULL, 
	lead_id UUID NOT NULL, 
	lead_name VARCHAR(200) NOT NULL, 
	user_id UUID, 
	user_name VARCHAR(200), 
	type VARCHAR(50) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	metadata_json JSONB, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(lead_id) REFERENCES leads (id) ON DELETE CASCADE
)
    """)
    op.execute("""
CREATE TABLE appointments (
	id UUID NOT NULL, 
	lead_id UUID NOT NULL, 
	assigned_user_id UUID NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	description TEXT, 
	start_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	end_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	timezone VARCHAR(64) NOT NULL, 
	duration_minutes INTEGER NOT NULL, 
	meeting_type VARCHAR(100) NOT NULL, 
	meeting_url VARCHAR(500), 
	external_event_id VARCHAR(255), 
	calendar_provider VARCHAR(50), 
	status VARCHAR(50) NOT NULL, 
	location VARCHAR(255), 
	notes TEXT, 
	google_meet BOOLEAN NOT NULL, 
	idempotency_key VARCHAR(128), 
	lead_name VARCHAR(200) NOT NULL, 
	lead_company VARCHAR(255) NOT NULL, 
	lead_email VARCHAR(255) NOT NULL, 
	salesperson_name VARCHAR(200) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	cancelled_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(lead_id) REFERENCES leads (id) ON DELETE CASCADE, 
	FOREIGN KEY(assigned_user_id) REFERENCES users (id) ON DELETE CASCADE
)
    """)
    op.execute("""
CREATE TABLE conversations (
	id UUID NOT NULL, 
	lead_id UUID NOT NULL, 
	channel VARCHAR(50) NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	assigned_user_id UUID, 
	human_handoff_requested BOOLEAN NOT NULL, 
	human_handoff_at TIMESTAMP WITH TIME ZONE, 
	summary TEXT, 
	public_token_hash VARCHAR(128), 
	started_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	closed_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(lead_id) REFERENCES leads (id) ON DELETE CASCADE, 
	FOREIGN KEY(assigned_user_id) REFERENCES users (id) ON DELETE SET NULL
)
    """)
    op.execute("""
CREATE TABLE email_logs (
	id UUID NOT NULL, 
	lead_id UUID, 
	conversation_id UUID, 
	template_id UUID, 
	template_slug VARCHAR(150) NOT NULL, 
	sender VARCHAR(255) NOT NULL, 
	recipient VARCHAR(255) NOT NULL, 
	subject VARCHAR(255) NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	provider_message_id VARCHAR(255), 
	error_message TEXT, 
	sent_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(lead_id) REFERENCES leads (id) ON DELETE SET NULL, 
	FOREIGN KEY(template_id) REFERENCES email_templates (id) ON DELETE SET NULL
)
    """)
    op.execute("""
CREATE TABLE lead_assignment_history (
	id UUID NOT NULL, 
	lead_id UUID NOT NULL, 
	previous_user_id UUID, 
	new_user_id UUID, 
	assigned_by_user_id UUID, 
	reason TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(lead_id) REFERENCES leads (id) ON DELETE CASCADE
)
    """)
    op.execute("""
CREATE TABLE lead_notes (
	id UUID NOT NULL, 
	lead_id UUID NOT NULL, 
	author_id UUID NOT NULL, 
	content TEXT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(lead_id) REFERENCES leads (id) ON DELETE CASCADE, 
	FOREIGN KEY(author_id) REFERENCES users (id) ON DELETE SET NULL
)
    """)
    op.execute("""
CREATE TABLE lead_score_history (
	id UUID NOT NULL, 
	lead_id UUID NOT NULL, 
	previous_score INTEGER NOT NULL, 
	new_score INTEGER NOT NULL, 
	reason TEXT, 
	changed_by_user_id UUID, 
	changed_by_system BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(lead_id) REFERENCES leads (id) ON DELETE CASCADE, 
	FOREIGN KEY(changed_by_user_id) REFERENCES users (id) ON DELETE SET NULL
)
    """)
    op.execute("""
CREATE TABLE lead_scores (
	id UUID NOT NULL, 
	lead_id UUID NOT NULL, 
	total_score INTEGER NOT NULL, 
	budget_score INTEGER NOT NULL, 
	urgency_score INTEGER NOT NULL, 
	service_fit_score INTEGER NOT NULL, 
	decision_authority_score INTEGER NOT NULL, 
	company_size_score INTEGER NOT NULL, 
	profile_completeness_score INTEGER NOT NULL, 
	reasoning_json JSONB, 
	calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	calculated_by VARCHAR(50) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(lead_id) REFERENCES leads (id) ON DELETE CASCADE
)
    """)
    op.execute("""
CREATE TABLE lead_tags (
	lead_id UUID NOT NULL, 
	tag_id UUID NOT NULL, 
	PRIMARY KEY (lead_id, tag_id), 
	FOREIGN KEY(lead_id) REFERENCES leads (id) ON DELETE CASCADE, 
	FOREIGN KEY(tag_id) REFERENCES tags (id) ON DELETE CASCADE
)
    """)
    op.execute("""
CREATE TABLE tasks (
	id UUID NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	description TEXT, 
	lead_id UUID, 
	lead_name VARCHAR(200), 
	assigned_user_id UUID NOT NULL, 
	assigned_user_name VARCHAR(200) NOT NULL, 
	created_by_user_id UUID, 
	priority VARCHAR(20) NOT NULL, 
	status VARCHAR(30) NOT NULL, 
	due_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	completed_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(lead_id) REFERENCES leads (id) ON DELETE SET NULL, 
	FOREIGN KEY(assigned_user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
)
    """)
    op.execute("""
CREATE TABLE workflow_executions (
	id UUID NOT NULL, 
	workflow_id UUID NOT NULL, 
	lead_id UUID, 
	external_execution_id VARCHAR(100), 
	status VARCHAR(30) NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	finished_at TIMESTAMP WITH TIME ZONE, 
	duration_ms INTEGER, 
	retry_count INTEGER NOT NULL, 
	input_json JSONB, 
	output_json JSONB, 
	error_message TEXT, 
	idempotency_key VARCHAR(128), 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(workflow_id) REFERENCES workflows (id) ON DELETE CASCADE, 
	FOREIGN KEY(lead_id) REFERENCES leads (id) ON DELETE SET NULL
)
    """)
    op.execute("""
CREATE TABLE messages (
	id UUID NOT NULL, 
	conversation_id UUID NOT NULL, 
	sender_type VARCHAR(20) NOT NULL, 
	sender_user_id UUID, 
	sender_name VARCHAR(150), 
	content TEXT NOT NULL, 
	intent VARCHAR(50), 
	metadata_json JSONB, 
	read BOOLEAN NOT NULL, 
	llm_model VARCHAR(100), 
	prompt_tokens INTEGER, 
	completion_tokens INTEGER, 
	total_tokens INTEGER, 
	estimated_cost FLOAT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(conversation_id) REFERENCES conversations (id) ON DELETE CASCADE, 
	FOREIGN KEY(sender_user_id) REFERENCES users (id) ON DELETE SET NULL
)
    """)
    op.create_index('ix_app_settings_category', 'app_settings', ['category'], unique=True)
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_entity_type', 'audit_logs', ['entity_type'])
    op.create_index('ix_audit_logs_result', 'audit_logs', ['result'])
    op.create_index('ix_audit_logs_request_id', 'audit_logs', ['request_id'])
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])
    op.create_index('ix_integration_connections_provider', 'integration_connections', ['provider'], unique=True)
    op.create_index('ix_users_status', 'users', ['status'])
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_calendar_connections_user_id', 'calendar_connections', ['user_id'], unique=True)
    op.create_index('ix_knowledge_chunks_document_id', 'knowledge_chunks', ['document_id'])
    op.create_index('ix_leads_assigned_user_id', 'leads', ['assigned_user_id'])
    op.create_index('ix_leads_score', 'leads', ['score'])
    op.create_index('ix_leads_temperature', 'leads', ['temperature'])
    op.create_index('ix_leads_next_follow_up_at', 'leads', ['next_follow_up_at'])
    op.create_index('ix_leads_created_at', 'leads', ['created_at'])
    op.create_index('ix_leads_source', 'leads', ['source'])
    op.create_index('ix_leads_status', 'leads', ['status'])
    op.create_index('ix_leads_phone', 'leads', ['phone'])
    op.create_index('ix_leads_email', 'leads', ['email'])
    op.create_index('ix_notifications_category', 'notifications', ['category'])
    op.create_index('ix_notifications_created_at', 'notifications', ['created_at'])
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('ix_password_reset_tokens_user_id', 'password_reset_tokens', ['user_id'])
    op.create_index('ix_password_reset_tokens_token_hash', 'password_reset_tokens', ['token_hash'], unique=True)
    op.create_index('ix_refresh_tokens_token_hash', 'refresh_tokens', ['token_hash'], unique=True)
    op.create_index('ix_refresh_tokens_user_id', 'refresh_tokens', ['user_id'])
    op.create_index('ix_activities_lead_id', 'activities', ['lead_id'])
    op.create_index('ix_activities_created_at', 'activities', ['created_at'])
    op.create_index('ix_activities_type', 'activities', ['type'])
    op.create_index('ix_appointments_assigned_user_id', 'appointments', ['assigned_user_id'])
    op.create_index('ix_appointments_start_at', 'appointments', ['start_at'])
    op.create_index('ix_appointments_external_event_id', 'appointments', ['external_event_id'])
    op.create_index('ix_appointments_idempotency_key', 'appointments', ['idempotency_key'], unique=True)
    op.create_index('ix_appointments_lead_id', 'appointments', ['lead_id'])
    op.create_index('ix_appointments_status', 'appointments', ['status'])
    op.create_index('ix_conversations_assigned_user_id', 'conversations', ['assigned_user_id'])
    op.create_index('ix_conversations_status', 'conversations', ['status'])
    op.create_index('ix_conversations_public_token_hash', 'conversations', ['public_token_hash'])
    op.create_index('ix_conversations_lead_id', 'conversations', ['lead_id'])
    op.create_index('ix_email_logs_lead_id', 'email_logs', ['lead_id'])
    op.create_index('ix_lead_assignment_history_lead_id', 'lead_assignment_history', ['lead_id'])
    op.create_index('ix_lead_notes_lead_id', 'lead_notes', ['lead_id'])
    op.create_index('ix_lead_score_history_lead_id', 'lead_score_history', ['lead_id'])
    op.create_index('ix_lead_scores_lead_id', 'lead_scores', ['lead_id'])
    op.create_index('ix_tasks_lead_id', 'tasks', ['lead_id'])
    op.create_index('ix_tasks_status', 'tasks', ['status'])
    op.create_index('ix_tasks_due_at', 'tasks', ['due_at'])
    op.create_index('ix_tasks_assigned_user_id', 'tasks', ['assigned_user_id'])
    op.create_index('ix_tasks_priority', 'tasks', ['priority'])
    op.create_index('ix_workflow_executions_lead_id', 'workflow_executions', ['lead_id'])
    op.create_index('ix_workflow_executions_workflow_id', 'workflow_executions', ['workflow_id'])
    op.create_index('ix_workflow_executions_status', 'workflow_executions', ['status'])
    op.create_index('ix_workflow_executions_idempotency_key', 'workflow_executions', ['idempotency_key'], unique=True)
    op.create_index('ix_messages_created_at', 'messages', ['created_at'])
    op.create_index('ix_messages_conversation_id', 'messages', ['conversation_id'])


def downgrade() -> None:
    op.drop_table("messages")
    op.drop_table("workflow_executions")
    op.drop_table("tasks")
    op.drop_table("lead_tags")
    op.drop_table("lead_scores")
    op.drop_table("lead_score_history")
    op.drop_table("lead_notes")
    op.drop_table("lead_assignment_history")
    op.drop_table("email_logs")
    op.drop_table("conversations")
    op.drop_table("appointments")
    op.drop_table("activities")
    op.drop_table("refresh_tokens")
    op.drop_table("password_reset_tokens")
    op.drop_table("notifications")
    op.drop_table("leads")
    op.drop_table("knowledge_chunks")
    op.drop_table("calendar_connections")
    op.drop_table("workflows")
    op.drop_table("users")
    op.drop_table("tags")
    op.drop_table("knowledge_documents")
    op.drop_table("integration_connections")
    op.drop_table("faq_entries")
    op.drop_table("email_templates")
    op.drop_table("audit_logs")
    op.drop_table("app_settings")
