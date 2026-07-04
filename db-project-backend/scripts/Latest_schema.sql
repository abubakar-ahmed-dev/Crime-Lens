-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.spatial_ref_sys (
  srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
  auth_name character varying,
  auth_srid integer,
  srtext character varying,
  proj4text character varying,
  CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);
CREATE TABLE public.Role (
  id integer NOT NULL DEFAULT nextval('"Role_id_seq"'::regclass),
  name text NOT NULL UNIQUE,
  description text,
  CONSTRAINT Role_pkey PRIMARY KEY (id)
);
CREATE TABLE public.Zone (
  id integer NOT NULL DEFAULT nextval('"Zone_id_seq"'::regclass),
  name text NOT NULL UNIQUE,
  boundary USER-DEFINED,
  CONSTRAINT Zone_pkey PRIMARY KEY (id)
);
CREATE TABLE public.CrimeType (
  id integer NOT NULL DEFAULT nextval('"CrimeType_id_seq"'::regclass),
  name text NOT NULL UNIQUE,
  severity integer NOT NULL DEFAULT 1,
  CONSTRAINT CrimeType_pkey PRIMARY KEY (id)
);
CREATE TABLE public.User (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  username text NOT NULL UNIQUE,
  passwordHash text NOT NULL,
  roleId integer NOT NULL,
  createdAt timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT User_pkey PRIMARY KEY (id),
  CONSTRAINT User_roleId_fkey FOREIGN KEY (roleId) REFERENCES public.Role(id)
);
CREATE TABLE public.PoliceBranch (
  id integer NOT NULL DEFAULT nextval('"PoliceBranch_id_seq"'::regclass),
  branchHeadUserId integer,
  zoneId integer NOT NULL UNIQUE,
  name text NOT NULL,
  address text NOT NULL,
  contactNumber text NOT NULL,
  location USER-DEFINED NOT NULL,
  CONSTRAINT PoliceBranch_pkey PRIMARY KEY (id),
  CONSTRAINT PoliceBranch_zoneId_fkey FOREIGN KEY (zoneId) REFERENCES public.Zone(id),
  CONSTRAINT PoliceBranch_branchHeadUserId_fkey FOREIGN KEY (branchHeadUserId) REFERENCES public.User(id)
);
CREATE TABLE public.CrimeReportsSubmitter (
  submitterCnic text,
  supabaseUserId text UNIQUE,
  email text UNIQUE,
  fullName text,
  contact text,
  address text,
  isProfileComplete boolean DEFAULT false,
  createdAt timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  CONSTRAINT CrimeReportsSubmitter_pkey PRIMARY KEY (id)
);
CREATE TABLE public.Crime (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  title text NOT NULL,
  description text,
  crimeTypeId integer NOT NULL,
  incidentDate timestamp with time zone NOT NULL,
  reportedAt timestamp with time zone NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::"enum_Crime_status",
  location USER-DEFINED,
  address text,
  zoneId integer,
  latestUpdatedBy integer,
  CONSTRAINT Crime_pkey PRIMARY KEY (id),
  CONSTRAINT Crime_crimeTypeId_fkey FOREIGN KEY (crimeTypeId) REFERENCES public.CrimeType(id),
  CONSTRAINT Crime_zoneId_fkey FOREIGN KEY (zoneId) REFERENCES public.Zone(id),
  CONSTRAINT Crime_latestUpdatedBy_fkey FOREIGN KEY (latestUpdatedBy) REFERENCES public.User(id)
);
CREATE TABLE public.CrimeSubmission (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  submittedAt timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CrimeId bigint NOT NULL,
  submitterId uuid NOT NULL,
  CONSTRAINT CrimeSubmission_pkey PRIMARY KEY (id),
  CONSTRAINT CrimeSubmission_CrimeId_fkey FOREIGN KEY (CrimeId) REFERENCES public.Crime(id),
  CONSTRAINT CrimeSubmission_submitterId_fkey FOREIGN KEY (submitterId) REFERENCES public.CrimeReportsSubmitter(id)
);
CREATE TABLE public.PoliceAgentRequestsTemp (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  createdAt timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT PoliceAgentRequestsTemp_pkey PRIMARY KEY (id)
);
CREATE TABLE public.PoliceAgentRequest (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  policeAgentRequestsTempId bigint,
  userId integer,
  branchId integer,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::"enum_PoliceAgentRequest_status",
  createdAt timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT PoliceAgentRequest_pkey PRIMARY KEY (id),
  CONSTRAINT PoliceAgentRequest_policeAgentRequestsTempId_fkey FOREIGN KEY (policeAgentRequestsTempId) REFERENCES public.PoliceAgentRequestsTemp(id),
  CONSTRAINT PoliceAgentRequest_userId_fkey FOREIGN KEY (userId) REFERENCES public.User(id),
  CONSTRAINT PoliceAgentRequest_branchId_fkey FOREIGN KEY (branchId) REFERENCES public.PoliceBranch(id)
);
CREATE TABLE public.UploadLog (
  id integer NOT NULL DEFAULT nextval('"UploadLog_id_seq"'::regclass),
  filename text,
  status USER-DEFINED NOT NULL DEFAULT 'uploaded'::"enum_UploadLog_status",
  totalRecords integer,
  recordsUploaded integer NOT NULL DEFAULT 0,
  uploadedAt timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT UploadLog_pkey PRIMARY KEY (id)
);
CREATE TABLE public.activitylog (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  tablename text NOT NULL,
  recordid bigint NOT NULL,
  action text NOT NULL,
  description text,
  createdat timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT activitylog_pkey PRIMARY KEY (id)
);