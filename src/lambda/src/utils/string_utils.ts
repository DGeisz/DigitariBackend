export function randomString(
    length: number,
    chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
): string {
    let result = "";
    for (let i = length; i > 0; --i)
        result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

export function filterEmoji(text: string): string {
    return text.replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, "");
}
