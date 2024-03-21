CREATE TABLE
  account (
    id VARCHAR PRIMARY KEY,
    total_donations_usd DECIMAL(10, 2),
    total_matching_pool_allocations_usd DECIMAL(10, 2),
    donors_count INT
  );

CREATE TABLE
  list (
    id VARCHAR PRIMARY KEY,
    owner_id VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    description TEXT,
    default_registration_status ENUM(
      'Pending',
      'Approved',
      'Rejected',
      'Graylisted',
      'Blacklisted'
    ) NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES account (id)
  );

CREATE TABLE
  list_admin (
    list_id INT NOT NULL,
    admin_id VARCHAR NOT NULL,
    PRIMARY KEY (list_id, admin_id),
    FOREIGN KEY (list_id) REFERENCES list (id),
    FOREIGN KEY (admin_id) REFERENCES account (id)
  );

CREATE TABLE
  list_registration (
    id SERIAL PRIMARY KEY,
    registrant_id VARCHAR NOT NULL,
    status ENUM(
      'Pending',
      'Approved',
      'Rejected',
      'Graylisted',
      'Blacklisted'
    ) NOT NULL,
    submitted_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP,
    registrant_notes TEXT,
    admin_notes TEXT,
    tx_hash VARCHAR,
    FOREIGN KEY (registrant_id) REFERENCES account (id)
  );

CREATE TABLE
  pot_factory (
    id VARCHAR PRIMARY KEY,
    owner_id VARCHAR NOT NULL,
    deployed_at TIMESTAMP NOT NULL,
    source_metadata VARCHAR NOT NULL,
    protocol_fee_basis_points INT NOT NULL,
    protocol_fee_recipient_account VARCHAR NOT NULL,
    require_whitelist BOOLEAN NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES account (id),
    FOREIGN KEY (protocol_fee_recipient_account) REFERENCES account (id)
  );

CREATE TABLE
  pot_factory_admin (
    pot_factory_id INT NOT NULL,
    admin_id VARCHAR NOT NULL,
    PRIMARY KEY (pot_factory_id, admin_id),
    FOREIGN KEY (pot_factory_id) REFERENCES pot_factory (id),
    FOREIGN KEY (admin_id) REFERENCES account (id)
  );

CREATE TABLE
  pot_factory_whitelisted_deployer (
    pot_factory_id INT NOT NULL,
    whitelisted_deployer_id VARCHAR NOT NULL,
    PRIMARY KEY (pot_factory_id, whitelisted_deployer_id),
    FOREIGN KEY (pot_factory_id) REFERENCES pot_factory (id),
    FOREIGN KEY (whitelisted_deployer_id) REFERENCES account (id)
  );

CREATE TABLE
  pot (
    id VARCHAR PRIMARY KEY,
    pot_factory_id INT NOT NULL,
    deployer_id VARCHAR NOT NULL,
    deployed_at TIMESTAMP NOT NULL,
    source_metadata VARCHAR NOT NULL,
    owner_id VARCHAR NOT NULL,
    chef_id VARCHAR NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    max_approved_applicants INT NOT NULL,
    base_currency VARCHAR NULL,
    application_start TIMESTAMP NOT NULL,
    application_end TIMESTAMP NOT NULL,
    matching_round_start TIMESTAMP NOT NULL,
    matching_round_end TIMESTAMP NOT NULL,
    registry_provider VARCHAR NULL,
    min_matching_pool_donation_amount VARCHAR NOT NULL,
    sybil_wrapper_provider VARCHAR NULL,
    custom_sybil_checks VARCHAR NULL,
    custom_min_threshold_score INT NULL,
    referral_fee_matching_pool_basis_points INT NOT NULL,
    referral_fee_public_round_basis_points INT NOT NULL,
    chef_fee_basis_points INT NOT NULL,
    total_matching_pool VARCHAR NOT NULL,
    total_matching_pool_usd DECIMAL(10, 2) NULL,
    matching_pool_balance VARCHAR NOT NULL,
    matching_pool_donations_count INT NOT NULL,
    total_public_donations VARCHAR NOT NULL,
    total_public_donations_usd DECIMAL(10, 2) NULL,
    public_donations_count INT NOT NULL,
    cooldown_end TIMESTAMP NULL,
    all_paid_out BOOLEAN NOT NULL,
    protocol_config_provider VARCHAR NULL,
    FOREIGN KEY (pot_factory_id) REFERENCES pot_factory (id),
    FOREIGN KEY (deployer_id) REFERENCES account (id),
    FOREIGN KEY (owner_id) REFERENCES account (id),
    FOREIGN KEY (chef_id) REFERENCES account (id),
    FOREIGN KEY (base_currency) REFERENCES account (id)
  );

-- Table pot_application
CREATE TABLE
  pot_application (
    id SERIAL PRIMARY KEY,
    pot_id INT NOT NULL,
    applicant_id VARCHAR NOT NULL,
    message TEXT,
    current_status ENUM('Pending', 'Approved', 'Rejected', 'InReview') NOT NULL,
    submitted_at TIMESTAMP NOT NULL,
    last_updated_at TIMESTAMP,
    tx_hash VARCHAR,
    FOREIGN KEY (pot_id) REFERENCES pot (id),
    FOREIGN KEY (applicant_id) REFERENCES account (id)
  );

-- Table pot_application_review
CREATE TABLE
  pot_application_review (
    id SERIAL PRIMARY KEY,
    application_id INT NOT NULL,
    reviewer_id VARCHAR NOT NULL,
    notes TEXT,
    status ENUM('Pending', 'Approved', 'Rejected', 'InReview') NOT NULL,
    reviewed_at TIMESTAMP NOT NULL,
    tx_hash VARCHAR,
    FOREIGN KEY (application_id) REFERENCES pot_application (id),
    FOREIGN KEY (reviewer_id) REFERENCES account (id)
  );

-- Table pot_payout
CREATE TABLE
  pot_payout (
    id SERIAL PRIMARY KEY,
    recipient_id VARCHAR NOT NULL,
    amount VARCHAR NOT NULL,
    amount_usd DECIMAL(10, 2),
    ft_id VARCHAR NOT NULL,
    paid_at TIMESTAMP,
    tx_hash VARCHAR,
    FOREIGN KEY (recipient_id) REFERENCES account (id)
  );

-- Table pot_payout_challenge
CREATE TABLE
  pot_payout_challenge (
    id SERIAL PRIMARY KEY,
    challenger_id VARCHAR NOT NULL,
    pot_id INT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    message TEXT NOT NULL,
    tx_hash VARCHAR,
    FOREIGN KEY (challenger_id) REFERENCES account (id),
    FOREIGN KEY (pot_id) REFERENCES pot (id)
  );

-- Table pot_payout_challenge_admin_response
CREATE TABLE
  pot_payout_challenge_admin_response (
    id SERIAL PRIMARY KEY,
    challenge_id INT NOT NULL,
    admin_id VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL,
    message TEXT,
    resolved BOOL NOT NULL,
    tx_hash VARCHAR,
    FOREIGN KEY (challenge_id) REFERENCES pot_payout_challenge (id),
    FOREIGN KEY (admin_id) REFERENCES account (id)
  );

-- Table donation
CREATE TABLE
  donation (
    id SERIAL PRIMARY KEY,
    donor_id VARCHAR NOT NULL,
    total_amount VARCHAR NOT NULL,
    total_amount_usd DECIMAL(10, 2),
    net_amount VARCHAR NOT NULL,
    net_amount_usd DECIMAL(10, 2),
    ft_id VARCHAR,
    pot_id INT,
    matching_pool BOOLEAN NOT NULL,
    message TEXT,
    donated_at TIMESTAMP NOT NULL,
    recipient_id VARCHAR,
    protocol_fee VARCHAR NOT NULL,
    protocol_fee_usd DECIMAL(10, 2),
    referrer_id VARCHAR,
    referrer_fee VARCHAR,
    referrer_fee_usd DECIMAL(10, 2),
    chef_id VARCHAR,
    chef_fee VARCHAR,
    chef_fee_usd DECIMAL(10, 2),
    tx_hash VARCHAR,
    FOREIGN KEY (donor_id) REFERENCES account (id),
    FOREIGN KEY (pot_id) REFERENCES pot (id),
    FOREIGN KEY (recipient_id) REFERENCES account (id)
  );

-- Table activity
CREATE TABLE
  activity (
    id SERIAL PRIMARY KEY,
    signer_id VARCHAR NOT NULL,
    receiver_id VARCHAR NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    action_result VARCHAR,
    tx_hash VARCHAR,
    type
      ENUM(
        'Donate_Direct',
        'Donate_Pot_Public',
        'Donate_Pot_Matching_Pool',
        'Register',
        'Deploy_Pot',
        'Process_Payouts',
        'Challenge_Payout',
        'Submit_Application',
        'Update_Pot_Config',
        'Add_List_Admin',
        'Remove_List_Admin'
      ) NOT NULL
  );

CREATE TABLE
  pot_admin (
    pot_id INT NOT NULL,
    admin_id VARCHAR NOT NULL,
    PRIMARY KEY (pot_id, admin_id),
    FOREIGN KEY (pot_id) REFERENCES pot (id),
    FOREIGN KEY (admin_id) REFERENCES account (id)
  );

-- pot index

-- CREATE INDEX "deploy_time_idx" ON pot (deployed_at);
CREATE INDEX idx_pot_application_start ON pot (application_start);
CREATE INDEX idx_pot_application_end ON pot (application_end);
CREATE INDEX "idx_pot_deployer_id" ON pot (deployer_id);

-- pot application index

CREATE INDEX idx_pot_application_pot_id ON pot_application (pot_id);
CREATE INDEX idx_pot_application_applicant_id ON pot_application (applicant_id); 
CREATE INDEX idx_pot_application_submitted_at ON pot_application (submitted_at);


-- payout index
CREATE INDEX idx_pot_payout_recipient_id ON pot_payout (recipient_id);

-- donation index
CREATE INDEX idx_donation_donor_id ON donation (donor_id);
CREATE INDEX idx_donation_pot_id ON donation (pot_id);
CREATE INDEX idx_donation_donated_at ON donation (donated_at);

-- activity index
CREATE INDEX idx_activity_timestamp ON activity (timestamp);

-- CREATE INDEX idx_pot_payout_recipient_id ON pot_payout (recipient_id);
-- CREATE INDEX idx_pot_payout_ft_id ON pot_payout (ft_id);
CREATE INDEX idx_pot_payout_paid_at ON pot_payout (paid_at);


