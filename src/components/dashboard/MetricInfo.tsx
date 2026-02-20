export function MetricInfo({ label, description, style }: { label: string, description: string, style?: any }) {
    return (
        <span style={{ ...style, position: 'relative', display: 'inline-block', cursor: 'help' }} className="metric-tooltip-trigger">
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {label}
                <span style={{ opacity: 0.5, fontSize: '0.7em' }}>ⓘ</span>
            </span>
            <div className="metric-tooltip">
                {description}
            </div>
        </span>
    )
}
