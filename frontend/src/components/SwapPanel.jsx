import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  HOOK_ABI,
  ERC20_ABI,
  SWAP_ROUTER_ABI,
  ADDRESSES,
  CHAIN_CONFIG,
  TIER_INFO,
} from '../abis/contracts';
import { getTraderInfo } from '../utils/api';

// ============ Constants ============

const MAX_UINT160 = '1461501637330902918203684832716283019655932542975';
const MIN_SQRT_PRICE_LIMIT = '4295128739';       // TickMath.MIN_SQRT_PRICE + 1
const MAX_SQRT_PRICE_LIMIT = MAX_UINT160;         // TickMath.MAX_SQRT_PRICE - 1

// Default token list — update these with your deployed mock tokens
const DEFAULT_TOKENS = [
  {
    symbol: 'TLA',
    name: 'TrustLayer Token A',
    address: ADDRESSES.TOKEN_A,
    decimals: 18,
    logo: '🔵',
  },
  {
    symbol: 'TLB',
    name: 'TrustLayer Token B',
    address: ADDRESSES.TOKEN_B,
    decimals: 18,
    logo: '🟠',
  },
];

// ============ Token Selector ============

function TokenSelector({ selected, onSelect, tokens, label, disabled }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="token-selector-wrapper">
      <label className="token-label">{label}</label>
      <button
        className="token-selector-btn"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
      >
        {selected ? (
          <>
            <span className="token-logo">{selected.logo}</span>
            <span className="token-symbol">{selected.symbol}</span>
          </>
        ) : (
          <span>Select token</span>
        )}
        <span className="chevron">▾</span>
      </button>

      {open && (
        <div className="token-dropdown">
          {tokens.map((token) => (
            <button
              key={token.address}
              className={`token-option ${selected?.address === token.address ? 'selected' : ''}`}
              onClick={() => { onSelect(token); setOpen(false); }}
            >
              <span className="token-logo">{token.logo}</span>
              <div className="token-info">
                <span className="token-symbol">{token.symbol}</span>
                <span className="token-name">{token.name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Swap Panel ============

export default function SwapPanel({ address, signer, provider, isCorrectChain }) {
  // Token state
  const [tokenIn, setTokenIn] = useState(DEFAULT_TOKENS[0]);
  const [tokenOut, setTokenOut] = useState(DEFAULT_TOKENS[1]);
  const [amountIn, setAmountIn] = useState('');
  const [balanceIn, setBalanceIn] = useState(null);
  const [balanceOut, setBalanceOut] = useState(null);

  // Trader state
  const [traderInfo, setTraderInfo] = useState(null);
  const [tierConfig, setTierConfig] = useState(null);

  // TX state
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approving, setApproving] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);

  // ============ Fetch balances ============

  const fetchBalances = useCallback(async () => {
    if (!address || !provider || !tokenIn || !tokenOut) return;

    try {
      const tokenInContract = new ethers.Contract(tokenIn.address, ERC20_ABI, provider);
      const tokenOutContract = new ethers.Contract(tokenOut.address, ERC20_ABI, provider);

      const [balIn, balOut] = await Promise.all([
        tokenInContract.balanceOf(address),
        tokenOutContract.balanceOf(address),
      ]);

      setBalanceIn(ethers.formatUnits(balIn, tokenIn.decimals));
      setBalanceOut(ethers.formatUnits(balOut, tokenOut.decimals));
    } catch (err) {
      console.error('Balance fetch error:', err);
    }
  }, [address, provider, tokenIn, tokenOut]);

  // ============ Check approval ============

  const checkApproval = useCallback(async () => {
    if (!address || !provider || !tokenIn || !amountIn || !ADDRESSES.SWAP_ROUTER) return;

    try {
      const tokenContract = new ethers.Contract(tokenIn.address, ERC20_ABI, provider);
      const allowance = await tokenContract.allowance(address, ADDRESSES.SWAP_ROUTER);
      const required = ethers.parseUnits(amountIn || '0', tokenIn.decimals);
      setNeedsApproval(allowance < required);
    } catch (err) {
      console.error('Approval check error:', err);
    }
  }, [address, provider, tokenIn, amountIn]);

  // ============ Fetch trader info ============

  const fetchTraderInfo = useCallback(async () => {
    if (!address) return;
    try {
      const info = await getTraderInfo(address);
      setTraderInfo(info);
    } catch (err) {
      console.error('Trader info error:', err);
    }
  }, [address]);

  // ============ Effects ============

  useEffect(() => { fetchBalances(); }, [fetchBalances]);
  useEffect(() => { checkApproval(); }, [checkApproval]);
  useEffect(() => { fetchTraderInfo(); }, [fetchTraderInfo]);

  // ============ Swap tokens direction ============

  const flipTokens = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn('');
    setBalanceIn(balanceOut);
    setBalanceOut(balanceIn);
  };

  // ============ Approve ============

  const handleApprove = async () => {
    if (!signer || !tokenIn) return;
    setApproving(true);
    setError(null);

    try {
      const tokenContract = new ethers.Contract(tokenIn.address, ERC20_ABI, signer);
      const tx = await tokenContract.approve(
        ADDRESSES.SWAP_ROUTER,
        ethers.MaxUint256
      );
      await tx.wait();
      setNeedsApproval(false);
    } catch (err) {
      setError(`Approval failed: ${err.reason || err.message}`);
    } finally {
      setApproving(false);
    }
  };

  // ============ Execute Swap ============

  const handleSwap = async () => {
    if (!signer || !tokenIn || !tokenOut || !amountIn) return;
    setSwapping(true);
    setError(null);
    setTxHash(null);

    try {
      const router = new ethers.Contract(ADDRESSES.SWAP_ROUTER, SWAP_ROUTER_ABI, signer);

      // Determine token ordering (Uniswap requires currency0 < currency1)
      const [currency0, currency1] = tokenIn.address.toLowerCase() < tokenOut.address.toLowerCase()
        ? [tokenIn.address, tokenOut.address]
        : [tokenOut.address, tokenIn.address];

      const zeroForOne = tokenIn.address.toLowerCase() === currency0.toLowerCase();

      // Pool key — must match the deployed pool configuration
      const poolKey = {
        currency0: currency0,
        currency1: currency1,
        fee: 0x800000, // DYNAMIC_FEE_FLAG for V4 hooks
        tickSpacing: 60,
        hooks: ADDRESSES.HOOK,
      };

      // Swap params
      const amountSpecified = ethers.parseUnits(amountIn, tokenIn.decimals);
      const swapParams = {
        zeroForOne: zeroForOne,
        amountSpecified: -amountSpecified, // negative = exact input
        sqrtPriceLimitX96: zeroForOne ? MIN_SQRT_PRICE_LIMIT : MAX_SQRT_PRICE_LIMIT,
      };

      // Test settings (for PoolSwapTest router)
      const testSettings = {
        takeClaims: false,
        settleUsingBurn: false,
      };

      const tx = await router.swap(poolKey, swapParams, testSettings, '0x');
      const receipt = await tx.wait();

      setTxHash(receipt.hash);
      fetchBalances(); // Refresh balances
    } catch (err) {
      const reason = err.reason || err.message;
      // Parse common hook revert reasons
      if (reason.includes('TraderNotRegistered')) {
        setError('You are not registered as a trader. Go to Register tab first.');
      } else if (reason.includes('CredentialExpired')) {
        setError('Your credential has expired. Re-register with a fresh Aleo proof.');
      } else if (reason.includes('TradeTooLarge')) {
        setError(`Trade size exceeds your tier limit. Max: ${TIER_INFO[traderInfo?.tier]?.maxTrade || '?'} tokens.`);
      } else if (reason.includes('TierNotEnabled')) {
        setError('Your tier is currently disabled by the admin.');
      } else {
        setError(reason);
      }
    } finally {
      setSwapping(false);
    }
  };

  // ============ Computed state ============

  const tier = traderInfo?.tier || 0;
  const meta = TIER_INFO[tier];
  const canTrade = tier > 0;
  const isAmountValid = amountIn && parseFloat(amountIn) > 0;
  const hasInsufficientBalance = balanceIn && amountIn && parseFloat(amountIn) > parseFloat(balanceIn);

  // ============ Render ============

  if (!address) {
    return (
      <div className="panel panel-empty">
        <div className="empty-icon">🔗</div>
        <p>Connect your wallet to swap on TrustLayer</p>
      </div>
    );
  }

  if (!isCorrectChain) {
    return (
      <div className="panel panel-empty">
        <div className="empty-icon">⛓️</div>
        <p>Switch to {CHAIN_CONFIG.chainName} to use the swap</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>💱 Swap</h3>
        <p className="panel-desc">Trade tokens via Uniswap V4 with TrustLayer tier-based fees</p>
      </div>

      {/* Tier Status Banner */}
      <div className="swap-tier-banner" style={{ '--tier-color': meta.color }}>
        {canTrade ? (
          <>
            <div className="tier-badge-inline">
              <span className="tier-dot" style={{ background: meta.color }} />
              <strong>{meta.name} — {meta.label}</strong>
            </div>
            <div className="tier-stats">
              <span>Fee: <strong>{meta.fee}</strong></span>
              <span>Max Trade: <strong>{meta.maxTrade}</strong></span>
            </div>
          </>
        ) : (
          <div className="tier-warning">
            ⚠️ You are not registered. <strong>Register first</strong> in the Register tab to enable swapping.
          </div>
        )}
      </div>

      {/* Swap Card */}
      <div className="swap-card">
        {/* Token In */}
        <div className="swap-input-group">
          <div className="swap-input-header">
            <span>You pay</span>
            {balanceIn !== null && (
              <button className="balance-btn" onClick={() => setAmountIn(balanceIn)}>
                Balance: {parseFloat(balanceIn).toFixed(4)}
              </button>
            )}
          </div>
          <div className="swap-input-row">
            <input
              type="number"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              placeholder="0.0"
              className="swap-amount-input"
              min="0"
              step="any"
            />
            <TokenSelector
              selected={tokenIn}
              onSelect={(t) => { setTokenIn(t); setAmountIn(''); }}
              tokens={DEFAULT_TOKENS.filter(t => t.address !== tokenOut?.address)}
              label=""
            />
          </div>
        </div>

        {/* Flip button */}
        <div className="swap-flip-wrapper">
          <button className="swap-flip-btn" onClick={flipTokens}>
            ↕
          </button>
        </div>

        {/* Token Out */}
        <div className="swap-input-group">
          <div className="swap-input-header">
            <span>You receive</span>
            {balanceOut !== null && (
              <span className="balance-display">
                Balance: {parseFloat(balanceOut).toFixed(4)}
              </span>
            )}
          </div>
          <div className="swap-input-row">
            <input
              type="text"
              value={isAmountValid ? '~' : ''}
              placeholder="0.0"
              className="swap-amount-input"
              disabled
            />
            <TokenSelector
              selected={tokenOut}
              onSelect={(t) => setTokenOut(t)}
              tokens={DEFAULT_TOKENS.filter(t => t.address !== tokenIn?.address)}
              label=""
            />
          </div>
          <span className="hint">Exact output depends on pool liquidity and current price</span>
        </div>

        {/* Fee & Trade Info */}
        {isAmountValid && canTrade && (
          <div className="swap-info-rows">
            <div className="swap-info-row">
              <span>Fee Rate</span>
              <span className="highlight">{meta.fee}</span>
            </div>
            <div className="swap-info-row">
              <span>Est. Fee</span>
              <span>{(parseFloat(amountIn) * (parseInt(meta.fee) / 100)).toFixed(4)} {tokenIn?.symbol}</span>
            </div>
            <div className="swap-info-row">
              <span>Max Trade Limit</span>
              <span>{meta.maxTrade} tokens</span>
            </div>
            <div className="swap-info-row">
              <span>Router</span>
              <span className="mono small">{ADDRESSES.SWAP_ROUTER.slice(0, 10)}...</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="swap-actions">
          {!canTrade ? (
            <button className="btn btn-primary btn-lg swap-btn" disabled>
              🚫 Not Registered — Go to Register Tab
            </button>
          ) : hasInsufficientBalance ? (
            <button className="btn btn-primary btn-lg swap-btn" disabled>
              ❌ Insufficient {tokenIn?.symbol} Balance
            </button>
          ) : needsApproval ? (
            <button
              className="btn btn-primary btn-lg swap-btn"
              onClick={handleApprove}
              disabled={approving}
            >
              {approving ? '⏳ Approving...' : `✅ Approve ${tokenIn?.symbol}`}
            </button>
          ) : (
            <button
              className="btn btn-primary btn-lg swap-btn"
              onClick={handleSwap}
              disabled={swapping || !isAmountValid}
            >
              {swapping ? '⏳ Swapping...' : '💱 Swap'}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="result-box result-error">
          <strong>❌ Swap Failed</strong>
          <p>{error}</p>
        </div>
      )}

      {/* Success */}
      {txHash && (
        <div className="result-box result-success">
          <strong>✅ Swap Successful!</strong>
          <div className="result-details">
            <div>
              <span>TX Hash:</span>
              <a href={`${CHAIN_CONFIG.explorer}/tx/${txHash}`} target="_blank" rel="noreferrer" className="mono">
                {txHash.slice(0, 22)}...
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
