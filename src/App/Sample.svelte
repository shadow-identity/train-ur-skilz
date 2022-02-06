<script lang='ts'>
    export let samples = '';
    export let clientHeight: number;

</script>

<p bind:clientHeight translate="no">{samples}</p>

<style>
    p {
        font-size: var(--working-font-size);
        font-family: var(--working-font-family);
        text-align: left;

        padding: var(--working-padding);
        margin: var(--working-margin);
        border: var(--working-border-width) solid transparent;
    }
</style>