<script lang='ts'>
    import { createEventDispatcher } from "svelte";

    export let text: string;
    export let isMistake: boolean = false;
    export let height: number;

    const dispatch = createEventDispatcher<{input: string}>()

    const handleKeydown = (event: Event) => {
        const newText = (event.target as HTMLTextAreaElement).value
        if (text !== newText) {
            text = newText
            dispatch('input', text)
        }
    }
</script>

<!-- svelte-ignore a11y-autofocus -->
<textarea
    on:input={handleKeydown}
    class:invalid={isMistake}
    autofocus 
    spellcheck="false"
    style:height={height + 'px'}
>{text}</textarea>

<style>
    textarea {
        width: 100%;
        /* height: fit-content; */
        resize: none;
        font-size: var(--working-font-size);
        font-family: var(--working-font-family);

        padding: var(--working-padding);
        margin: var(--working-margin);
        border-width: var(--working-border-width);
    }

    .invalid {
        background-color: #ff000026;
    }
</style>