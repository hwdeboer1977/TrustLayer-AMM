# Makefile for TrustLayer Credentials
NETWORK = --network testnet --broadcast
ADMIN = aleo1d9es6d8kuzg65dlfdpx9zxchcsarh8k0hwxfx5eg6k4w7ew6gs8sv5aza0

.PHONY: build deploy setup issue prove revoke query-issuer query-issued query-revoked

build:
	leo build

deploy:
	leo deploy $(NETWORK)

setup:
	leo execute add_issuer $(ADMIN) $(NETWORK)

# Usage: make issue RECIPIENT=aleo1... SCORE=750 EXPIRY=50000000 NONCE=12345
issue:
	leo execute issue $(RECIPIENT) $(SCORE)u16 $(EXPIRY)u32 $(NONCE)field $(NETWORK)

# Usage: make prove CRED="<record>" BLOCK=500
prove:
	leo execute prove_tier '$(CRED)' $(BLOCK)u32 $(NETWORK)

# Usage: make revoke COMMITMENT=123...field
revoke:
	leo execute revoke $(COMMITMENT) $(NETWORK)

# Usage: make query-issuer ADDR=aleo1...
query-issuer:
	curl -s "https://api.explorer.provable.com/v1/testnet/program/trustlayer_credentials_amm.aleo/mapping/approved_issuers/$(ADDR)"

query-issued:
	curl -s "https://api.explorer.provable.com/v1/testnet/program/trustlayer_credentials_amm.aleo/mapping/issued/$(COMMITMENT)"

query-revoked:
	curl -s "https://api.explorer.provable.com/v1/testnet/program/trustlayer_credentials_amm.aleo/mapping/revoked/$(COMMITMENT)"
