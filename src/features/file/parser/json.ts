
export async function load(stream: ReadableStream<Uint8Array>): Promise<Map<string, string>> {
    return new Map(await Array.fromAsync(parse(stream), ({ key, value }) => [key, value]));
}

interface Entry {
    key: string;
    value: string;
}

interface State {
    (token: Token): State;
    entry?: Entry
}

const states = {
    none(): State {
        return (token: Token) => {
            if (token.kind === 'braceOpen') {
                return states.object();
            }

            return states.none;
        };
    },
    object({ path = [], expect = 'key' }: Partial<{ path: string[], expect: 'key' | 'colon' | 'value' }> = {}): State {
        return (token: Token) => {
            switch (expect) {
                case 'key': {
                    if (token.kind === 'braceClose') {
                        return states.object({
                            path: path.slice(0, -1),
                            expect: 'key',
                        });
                    }
                    else if (token.kind === 'string') {
                        return states.object({
                            path: [...path, token.value],
                            expect: 'colon'
                        });
                    }

                    return states.error(`Expected a key, got ${token.kind} instead`);
                }

                case 'colon': {
                    if (token.kind !== 'colon') {
                        return states.error(`Expected a ':', got ${token.kind} instead`);
                    }

                    return states.object({
                        path,
                        expect: 'value'
                    });
                }

                case 'value': {
                    if (token.kind === 'braceOpen') {
                        return states.object({
                            path,
                            expect: 'key',
                        });
                    }
                    else if (token.kind === 'string') {
                        const next = states.object({
                            path: path.slice(0, -1),
                            expect: 'key',
                        });

                        next.entry = { key: path.join('.'), value: token.value };

                        return next
                    }

                    return states.error(`Invalid value type found '${token.kind}'`);
                }
            }

            return states.none();
        }
    },
    error(message: string): State {
        throw new Error(message);

        return states.none();
    },
} as const;

async function* parse(stream: ReadableStream<Uint8Array>): AsyncGenerator<any, void, unknown> {
    let state = states.none();

    for await (const token of take(tokenize(read(toGenerator(stream))), 100)) {
        try {
            state = state(token);
        }
        catch (e) {
            console.error(e);

            break;
        }

        if (state.entry) {
            yield state.entry;
        }
    }
}

async function* take<T>(iterable: AsyncIterable<T>, numberToTake: number): AsyncGenerator<T, void, unknown> {
    let i = 0;
    for await (const entry of iterable) {
        yield entry;

        i++;

        if (i === numberToTake) {
            break;
        }
    }
}

type Token = { start: number, length: number } & (
    | { kind: 'braceOpen' }
    | { kind: 'braceClose' }
    | { kind: 'colon' }
    | { kind: 'string', value: string }
);

async function* tokenize(characters: AsyncIterable<number>): AsyncGenerator<Token, void, unknown> {
    let buffer: string = '';
    let clearBuffer = false;
    let start = 0;
    let i = 0;

    for await (const character of characters) {
        if (buffer.length === 0) {
            start = i;
        }

        buffer += String.fromCharCode(character);
        const length = buffer.length;

        if (buffer === '{') {
            yield { kind: 'braceOpen', start, length };
            clearBuffer = true;
        }
        else if (buffer === '}') {
            yield { kind: 'braceClose', start, length };
            clearBuffer = true;
        }
        else if (buffer === ':') {
            yield { kind: 'colon', start, length };
            clearBuffer = true;
        }
        else if (buffer.length > 1 && buffer.startsWith('"') && buffer.endsWith('"') && buffer.at(-2) !== '\\') {
            yield { kind: 'string', start, length, value: buffer.slice(1, buffer.length - 1) };
            clearBuffer = true;
        }
        else if (buffer === ',') {
            clearBuffer = true;
        }
        else if (buffer.trim() === '') {
            clearBuffer = true;
        }

        if (clearBuffer) {
            buffer = '';
            clearBuffer = false;
        }

        i++;
    }
}

async function* read(chunks: AsyncIterable<Uint8Array>): AsyncGenerator<number, void, unknown> {
    for await (const chunk of chunks) {
        for (const character of chunk) {
            yield character;
        }
    }
}

async function* toGenerator<T>(stream: ReadableStream<T>): AsyncGenerator<T, void, unknown> {
    const reader = stream.getReader();

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            yield value;
        }
    }
    finally {
        reader.releaseLock();
    }
}