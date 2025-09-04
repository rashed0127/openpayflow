-- Create the openpayflow database and user
CREATE USER openpayflow WITH PASSWORD 'openpayflow';
CREATE DATABASE openpayflow OWNER openpayflow;
GRANT ALL PRIVILEGES ON DATABASE openpayflow TO openpayflow;

-- Connect to the openpayflow database
\c openpayflow

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO openpayflow;
GRANT ALL ON ALL TABLES IN SCHEMA public TO openpayflow;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO openpayflow;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO openpayflow;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO openpayflow;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO openpayflow;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO openpayflow;
