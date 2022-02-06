import type { CharItem, SymbolsCollection } from "./constants";

export const getCharsStrings = (chars: CharItem[]) => {
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

export const getCollection = (symbolsCollections: SymbolsCollection[], id: number) => 
    symbolsCollections.find(collection => collection.id === id)

export const buildSample = (symbolsCollection: SymbolsCollection) => {
    let result = getCharsStrings(symbolsCollection.symbols)
    result = shuffleSattolo(result)
    let resultString = result.join(' ')
    return resultString
}

