<script lang="ts">
    import Form from "./App/Form.svelte";
    import Sample from "./App/Sample.svelte";
    import { symbolsConfig, getCharsString, shuffleSattolo } from "./constants";

    let isMistake = false
    let sampleHeight: number;
    let formText = ''

    const sampleText = shuffleSattolo(getCharsString(symbolsConfig)).join(' ')
    
    const handleInput = (event: CustomEvent<string>) => {
        const actual = event.detail
        const expected = sampleText.slice(0, actual.length)
        if (actual !== expected) {
            isMistake = true
            // console.log(`"${actual}" !== "${expected}"`)
        } else {
            isMistake = false
        }
    }
</script>

<header>
    <h1 style:opacity={formText.length > 0 ? '0.5' : '1'} translate="no">
        Train Ur Skilz!
    </h1>
</header>

<main>
    <Form on:input={handleInput} isMistake={isMistake} height={sampleHeight} bind:text={formText}/>
    <Sample samples={sampleText} bind:clientHeight={sampleHeight} />
</main>

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