<script lang='ts'>
import { buildSample, getCollection } from "./collectionUtils";

    import type { SymbolsCollection } from "./constants";

    export let symbolsCollections: SymbolsCollection[]
    export let selectedCollectionId: number = symbolsCollections[0].id
    export let sample: string = buildSample(getCollection(symbolsCollections, selectedCollectionId));

    $: sample = buildSample(getCollection(symbolsCollections, selectedCollectionId))

    // let value: number
    // $: console.log(value, symbolsCollections.find(collection => collection.id === value))
</script>

<sidebar>
    <select bind:value={selectedCollectionId}>
        {#each symbolsCollections as {id, name, layout}}
            <option value={id}>{layout}: {name}</option>
        {/each}
    </select> 
</sidebar>
