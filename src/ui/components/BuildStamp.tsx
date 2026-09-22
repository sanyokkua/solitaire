export function BuildStamp() {
    const rawValue = typeof __APP_BUILD_TIMESTAMP__ === 'string' ? __APP_BUILD_TIMESTAMP__ : 'dev version';
    const label = `App build: ${rawValue}`;

    return <footer aria-label={label}>{label}</footer>;
}
