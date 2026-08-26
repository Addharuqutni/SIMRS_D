const isProd = process.env.NODE_ENV === 'production';

const fmt = (level: string, arg: unknown) => {
    const time = new Date().toISOString().slice(0, 19).replace('T', ' ');
    return `[${time}] ${level}: ${typeof arg === 'string' ? arg : JSON.stringify(arg)}`;
};

// ponytail: console logger; switch to a real transport lib if log files/alerting ever needed
export const logger = {
    info: (msg: unknown) => console.log(fmt('info', msg)),
    warn: (msg: unknown) => console.warn(fmt('warn', msg)),
    error: (msg: unknown) => console.error(fmt('error', msg)),
    debug: (msg: unknown) => { if (!isProd) console.log(fmt('debug', msg)); },
};
