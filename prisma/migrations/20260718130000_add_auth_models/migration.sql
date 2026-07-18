-- Create User, VerificationToken, Session tables for magic-link auth
-- Update WorkspaceMember with FK to User

CREATE TABLE "User" (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE "VerificationToken" (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_verification_token_email ON "VerificationToken"(email);
CREATE INDEX idx_verification_token_token ON "VerificationToken"(token);

CREATE TABLE "Session" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    workspace_id TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_user_id ON "Session"(user_id);
CREATE INDEX idx_session_workspace_id ON "Session"(workspace_id);

-- Update WorkspaceMember to reference User
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT fk_workspace_member_user FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE;
