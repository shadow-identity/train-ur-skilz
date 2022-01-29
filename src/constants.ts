type CharItem = {
    names: string[];
    char: string;
}

export const symbolsConfig: CharItem[] = [
    {names: ['grave accent'], char: '`'},
    {names: ['tilde'], char: '~'},
    {names: ['exclamation mark', 'factorial', 'bang'], char: '!'},
    {names: ['at', 'commercial at'], char: '@'},
    {names: ['number'], char: '#'},
    {names: ['hash'], char: '#'},
    {names: ['dollar'], char: '$'},
    {names: ['percent'], char: '%'},
    {names: ['caret'], char: '^'},
    {names: ['circumflex accent'], char: '^'},
    {names: ['ampersand'], char: '&'},
    {names: ['asterisk'], char: '*'},
    {names: ['star'], char: '*'},
    {names: ['left parenthesis', 'opening parenthesis'], char: '('},
    {names: ['right parenthesis', 'closing parenthesis'], char: ')'},
    {names: ['parentheses', 'parens', 'round brackets'], char: '()'},
    {names: ['low line'], char: '_'},
    {names: ['hyphen', 'minus', 'hyphen-minus'], char: '-'},
    {names: ['plus'], char: '+'},
    {names: ['equals'], char: '='},
    {names: ['curly brackets', 'braces'], char: '{}'},
    {names: ['semicolon'], char: ';'},
    {names: ['colon'], char: ':'},
    {names: ['apostrophe', 'apostrophe-quote'], char: '\''},
    {names: ['quotation'], char: '"'},
    {names: ['less-than'], char: '<'},
    {names: ['greater-than'], char: '>'},
    {names: ['square brackets'], char: '[]'},
    {names: ['reverse solidus', 'backslash'], char: '\\'},
    {names: ['vertical bar', 'vertical line'], char: '|'},
    {names: ['solidus', 'slash'], char: '/'},
]

export const getCharsString = (chars: CharItem[]) => {
    // todo: parameters to add other names, replace space with char, capitalize etc
    return chars.map(charItem => `${charItem.names[0]} ${charItem.char}`)
}

export const shuffleSattolo = (source: string[]) => {
    const result = [...source]
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i - 1));
        [result[j], result[i]] = [result[i], result[j]]
    }
    return result
}
