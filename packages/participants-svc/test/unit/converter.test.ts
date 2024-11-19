import { stringToBigint, bigintToString } from '../../src/domain/converters';

describe('stringToBigint', () => {
    test('converts a valid string to bigint correctly', () => {
        const result = stringToBigint('123.456', 3);
        expect(result).toBe(BigInt(123456)); // 123.456 * 10^3
    });

    test('throws an error when the string has more decimals than specified', () => {
        expect(() => stringToBigint('123.45678', 3)).toThrow(
            "Provided string number has more decimals than the decimals param, stringToBigint() would lose precision"
        );
    });

    test('handles integer string inputs correctly', () => {
        const result = stringToBigint('123', 2);
        expect(result).toBe(BigInt(12300)); // 123 * 10^2
    });

    test('handles zero correctly', () => {
        const result = stringToBigint('0', 5);
        expect(result).toBe(BigInt(0)); // 0 * 10^5
    });

    test('throws an error for invalid numeric strings', () => {
        expect(() => stringToBigint('abc', 2)).toThrow();
    });

    
});

describe('bigintToString', () => {
    test('converts a valid bigint to string correctly', () => {
        const result = bigintToString(BigInt(123456), 3);
        expect(result).toBe('123.456'); // 123456 / 10^3
    });

    test('handles zero correctly', () => {
        const result = bigintToString(BigInt(0), 5);
        expect(result).toBe('0'); // 0 / 10^5
    });

    test('handles small scale (decimals=0) correctly', () => {
        const result = bigintToString(BigInt(123456), 0);
        expect(result).toBe('123456'); // 123456 / 10^0
    });
});
