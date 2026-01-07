export function StatusCard({ title, children, variant = 'default' }) {
    return (
        <div className={`card ${variant}`}>
            {title && <h2>{title}</h2>}
            {children}
        </div>
    );
}

export function InfoRow({ label, value, variant = '' }) {
    return (
        <div className="info-row">
            <span className="label">{label}</span>
            <span className={`value ${variant}`}>{value}</span>
        </div>
    );
}

export function TierBadge({ tier, tierName }) {
    return (
        <div className={`tier-badge tier-${tier}`}>
            {tierName}
        </div>
    );
}

export function LoadingSpinner() {
    return <div className="loading">Loading...</div>;
}

export function ErrorMessage({ message }) {
    if (!message) return null;
    return <div className="error-message">{message}</div>;
}

export function SuccessMessage({ message }) {
    if (!message) return null;
    return <div className="success-message">{message}</div>;
}