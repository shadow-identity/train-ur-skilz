<script lang="ts">
    import Form from "./Form.svelte";
    import Sample from "./Sample.svelte";
    import Sidebar from "./Sidebar.svelte";
    import { symbolsConfig } from "./constants";
    import { getSymbolsCollections } from "./db";

    let isMistake = false
    let sampleHeight: number;
    let formText = ''
    let collectionId: number = 0;
    let sample = ''
    console.log(sample)

    const filterCollections = async () => await getSymbolsCollections()
    
    // todo: move it to webworker
    const collectionsPromise = filterCollections()
    // const sampleText = shuffleSattolo(getCharsString(symbolsConfig[0].symbols)).join(' ')
    
    const handleInput = (event: CustomEvent<string>) => {
        const actual = event.detail
        const expected = sample.slice(0, actual.length)
        if (actual !== expected) {
            isMistake = true
            // console.log(`"${actual}" !== "${expected}"`)
        } else {
            isMistake = false
        }
    }
    // const getCollection = 

</script>

<header>
    <h1 style:opacity={formText.length > 0 ? '0.5' : '1'} translate="no">
        Train Ur Skilz!
    </h1>
</header>
{#await collectionsPromise}
    <p>...loading</p>
{:then collections}
    <Sidebar symbolsCollections={collections} bind:selectedCollectionId={collectionId} bind:sample />
{/await}

{#if sample}
    <main>
        <Form on:input={handleInput} isMistake={isMistake} height={sampleHeight} bind:text={formText} />
        <Sample samples={sample} bind:clientHeight={sampleHeight} />
    </main>
{/if}


<style>
    header {
        text-align: center;
    }

    main {
        text-align: center;
        padding: 1em;
        max-width: 80%;
        margin: 0 auto;
    }

    h1 {
        color: #ff3e00;
        text-transform: uppercase;
        font-size: 4em;
        font-weight: 100;
    }

    @media (min-width: 60em) {
        main {
            width: 80%;
            max-width: 50em;
        }
    }

    :root {
        --working-font-family: monospace;
        --working-font-size: xx-large;

        --working-padding: 0.4em;
        --working-margin: 0 0 0.5em 0;
        --working-border-width: 1px;
    }
</style>