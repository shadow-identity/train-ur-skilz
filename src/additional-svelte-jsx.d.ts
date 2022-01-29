declare namespace svelte.JSX {
    interface HTMLAttributes<T> {
        // workaround to support https://html.spec.whatwg.org/multipage/dom.html#attr-translate
        // remove after https://github.com/sveltejs/language-tools/pull/1350 is merged
        translate?: "yes" | "no" | "";
    }
}