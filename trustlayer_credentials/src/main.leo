program trustlayer_credentials_amm_v2.aleo {

    
    // DEVNET alternative 1
    // 1. leo build
    // 2. leo devnet --snarkos $(which snarkos) --snarkos-features test_network --consensus-heights 0,1,2,3,4,5,6,7,8,9,10,11 --clear-storage
    // 3. leo deploy --broadcast --consensus-heights 0,1,2,3,4,5,6,7,8,9,10,11
   
    // TESTNET
    // 1. leo build
    // 2. leo deploy --network testnet --broadcast
    // Can check it here: https://testnet.explorer.provable.com/transaction/tx....

    @noupgrade
    async constructor() {}

    
    // ============ CONSTANTS ============
    const ADMIN: address = aleo1d9es6d8kuzg65dlfdpx9zxchcsarh8k0hwxfx5eg6k4w7ew6gs8sv5aza0;
    
    const TIER_C_MIN: u16 = 600u16;
    const TIER_B_MIN: u16 = 700u16;
    const TIER_A_MIN: u16 = 800u16;

    // ============ RECORDS ============
    record Credential {
        owner: address,
        score: u16,
        expiry: u32,
        issuer: address,
        nonce: field,
    }

    // ============ MAPPINGS ============
    mapping approved_issuers: address => bool;
    mapping issued: field => bool;
    mapping revoked: field => bool;

    // ============ ADMIN FUNCTIONS ============

    async transition add_issuer(issuer: address) -> Future {
        assert_eq(self.caller, ADMIN);
        return finalize_add_issuer(issuer);
    }

    async function finalize_add_issuer(issuer: address) {
        Mapping::set(approved_issuers, issuer, true);
    }

    async transition remove_issuer(issuer: address) -> Future {
        assert_eq(self.caller, ADMIN);
        return finalize_remove_issuer(issuer);
    }

    async function finalize_remove_issuer(issuer: address) {
        Mapping::set(approved_issuers, issuer, false);
    }

    async transition revoke(commitment: field) -> Future {
        assert_eq(self.caller, ADMIN);
        return finalize_revoke(commitment);
    }

    async function finalize_revoke(commitment: field) {
        Mapping::set(revoked, commitment, true);
    }

    // ============ ISSUER FUNCTIONS ============
    
    async transition issue(
        recipient: address,
        score: u16,
        expiry: u32,
        nonce: field
    ) -> (Credential, Future) {
        let cred: Credential = Credential {
            owner: recipient,
            score: score,
            expiry: expiry,
            issuer: self.caller,
            nonce: nonce,
        };
        
        let commitment: field = BHP256::hash_to_field(nonce);
        
        return (cred, finalize_issue(self.caller, commitment));
    }

    async function finalize_issue(issuer: address, commitment: field) {
        let is_approved: bool = Mapping::get_or_use(approved_issuers, issuer, false);
        assert(is_approved);
        
        Mapping::set(issued, commitment, true);
    }

    // ============ TRADER PROOFS ============
    
    // Prove tier - output is PUBLIC so relayer can verify
    async transition prove_tier(
        cred: Credential,
        public current_block: u32
    ) -> (public u8, Future) {
        assert(cred.expiry > current_block);
        
        let tier: u8 = cred.score >= TIER_A_MIN ? 3u8 :
                       cred.score >= TIER_B_MIN ? 2u8 :
                       cred.score >= TIER_C_MIN ? 1u8 : 0u8;
        
        let commitment: field = BHP256::hash_to_field(cred.nonce);
        
        return (tier, finalize_prove_tier(commitment));
    }

    async function finalize_prove_tier(commitment: field) {
        let was_issued: bool = Mapping::get_or_use(issued, commitment, false);
        assert(was_issued);
        
        let is_revoked: bool = Mapping::get_or_use(revoked, commitment, false);
        assert(!is_revoked);
    }

    // Prove minimum tier - output is PUBLIC
    async transition prove_min_tier(
        cred: Credential,
        public required_tier: u8,
        public current_block: u32
    ) -> (public bool, Future) {
        assert(cred.expiry > current_block);
        
        let tier: u8 = cred.score >= TIER_A_MIN ? 3u8 :
                       cred.score >= TIER_B_MIN ? 2u8 :
                       cred.score >= TIER_C_MIN ? 1u8 : 0u8;
        
        let commitment: field = BHP256::hash_to_field(cred.nonce);
        
        return (tier >= required_tier, finalize_prove_min_tier(commitment));
    }

    async function finalize_prove_min_tier(commitment: field) {
        let was_issued: bool = Mapping::get_or_use(issued, commitment, false);
        assert(was_issued);
        
        let is_revoked: bool = Mapping::get_or_use(revoked, commitment, false);
        assert(!is_revoked);
    }
}
