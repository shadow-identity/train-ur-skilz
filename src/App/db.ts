import { DBSchema, IDBPDatabase, openDB } from "idb"
import { SymbolsCollection, symbolsConfig } from "./constants"

const name = 'trainUrSkilz'
const version = 2

enum DbStores {
    symbolsCollection = 'symbolsCollection',
    stats = 'stats',
}

interface TrainUrSkilzDB extends DBSchema {
    [DbStores.symbolsCollection]: {
        value: SymbolsCollection,
        key: number,
        indexes: {byName: string, byLayout: string},
    }
}

const upgradeDB = (db: IDBPDatabase<TrainUrSkilzDB>) => {
    if (db.objectStoreNames.contains(DbStores.symbolsCollection)) return;

    const symbolsStore = db.createObjectStore(DbStores.symbolsCollection, {
        autoIncrement: true,
        keyPath: 'id',
    })
    symbolsStore.createIndex('byName', 'name')
    symbolsStore.createIndex('byLayout', 'layout')
}

const initDB = async() => await openDB<TrainUrSkilzDB>(name, version, {upgrade: upgradeDB})

export const saveSymbolsCollection = async (data: SymbolsCollection) => {
    const db = await initDB()
    await db.put(DbStores.symbolsCollection, data)
}

export const getSymbolsCollections = async () => {
    const db = await initDB()
    return await db.getAll(DbStores.symbolsCollection)
}

export const storeDefaultSymbols = async () => {
    const db = await initDB()
    const tx = db.transaction(DbStores.symbolsCollection, 'readwrite')
    await Promise.all(symbolsConfig.map(symbolsCollection => tx.store.put(symbolsCollection)))
}