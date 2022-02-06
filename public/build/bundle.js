
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function is_promise(value) {
        return value && typeof value === 'object' && typeof value.then === 'function';
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
        select.selectedIndex = -1; // no option should be selected
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    // unfortunately this can't be a constant as that wouldn't be tree-shakeable
    // so we cache the result instead
    let crossorigin;
    function is_crossorigin() {
        if (crossorigin === undefined) {
            crossorigin = false;
            try {
                if (typeof window !== 'undefined' && window.parent) {
                    void window.parent.document;
                }
            }
            catch (error) {
                crossorigin = true;
            }
        }
        return crossorigin;
    }
    function add_resize_listener(node, fn) {
        const computed_style = getComputedStyle(node);
        if (computed_style.position === 'static') {
            node.style.position = 'relative';
        }
        const iframe = element('iframe');
        iframe.setAttribute('style', 'display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; ' +
            'overflow: hidden; border: 0; opacity: 0; pointer-events: none; z-index: -1;');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.tabIndex = -1;
        const crossorigin = is_crossorigin();
        let unsubscribe;
        if (crossorigin) {
            iframe.src = "data:text/html,<script>onresize=function(){parent.postMessage(0,'*')}</script>";
            unsubscribe = listen(window, 'message', (event) => {
                if (event.source === iframe.contentWindow)
                    fn();
            });
        }
        else {
            iframe.src = 'about:blank';
            iframe.onload = () => {
                unsubscribe = listen(iframe.contentWindow, 'resize', fn);
            };
        }
        append(node, iframe);
        return () => {
            if (crossorigin) {
                unsubscribe();
            }
            else if (unsubscribe && iframe.contentWindow) {
                unsubscribe();
            }
            detach(iframe);
        };
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    function handle_promise(promise, info) {
        const token = info.token = {};
        function update(type, index, key, value) {
            if (info.token !== token)
                return;
            info.resolved = value;
            let child_ctx = info.ctx;
            if (key !== undefined) {
                child_ctx = child_ctx.slice();
                child_ctx[key] = value;
            }
            const block = type && (info.current = type)(child_ctx);
            let needs_flush = false;
            if (info.block) {
                if (info.blocks) {
                    info.blocks.forEach((block, i) => {
                        if (i !== index && block) {
                            group_outros();
                            transition_out(block, 1, 1, () => {
                                if (info.blocks[i] === block) {
                                    info.blocks[i] = null;
                                }
                            });
                            check_outros();
                        }
                    });
                }
                else {
                    info.block.d(1);
                }
                block.c();
                transition_in(block, 1);
                block.m(info.mount(), info.anchor);
                needs_flush = true;
            }
            info.block = block;
            if (info.blocks)
                info.blocks[index] = block;
            if (needs_flush) {
                flush();
            }
        }
        if (is_promise(promise)) {
            const current_component = get_current_component();
            promise.then(value => {
                set_current_component(current_component);
                update(info.then, 1, info.value, value);
                set_current_component(null);
            }, error => {
                set_current_component(current_component);
                update(info.catch, 2, info.error, error);
                set_current_component(null);
                if (!info.hasCatch) {
                    throw error;
                }
            });
            // if we previously had a then/catch block, destroy it
            if (info.current !== info.pending) {
                update(info.pending, 0);
                return true;
            }
        }
        else {
            if (info.current !== info.then) {
                update(info.then, 1, info.value, promise);
                return true;
            }
            info.resolved = promise;
        }
    }
    function update_await_block_branch(info, ctx, dirty) {
        const child_ctx = ctx.slice();
        const { resolved } = info;
        if (info.current === info.then) {
            child_ctx[info.value] = resolved;
        }
        if (info.current === info.catch) {
            child_ctx[info.error] = resolved;
        }
        info.block.p(child_ctx, dirty);
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.46.3' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App\Form.svelte generated by Svelte v3.46.3 */
    const file$3 = "src\\App\\Form.svelte";

    function create_fragment$3(ctx) {
    	let textarea;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			textarea = element("textarea");
    			textarea.autofocus = true;
    			attr_dev(textarea, "spellcheck", "false");
    			textarea.value = /*text*/ ctx[0];
    			attr_dev(textarea, "class", "svelte-ejvcf6");
    			toggle_class(textarea, "invalid", /*isMistake*/ ctx[1]);
    			set_style(textarea, "height", /*height*/ ctx[2] + 'px', false);
    			add_location(textarea, file$3, 15, 0, 407);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, textarea, anchor);
    			textarea.focus();

    			if (!mounted) {
    				dispose = listen_dev(textarea, "input", /*handleKeydown*/ ctx[3], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*text*/ 1) {
    				prop_dev(textarea, "value", /*text*/ ctx[0]);
    			}

    			if (dirty & /*isMistake*/ 2) {
    				toggle_class(textarea, "invalid", /*isMistake*/ ctx[1]);
    			}

    			if (dirty & /*height*/ 4) {
    				set_style(textarea, "height", /*height*/ ctx[2] + 'px', false);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(textarea);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Form', slots, []);
    	let { text } = $$props;
    	let { isMistake = false } = $$props;
    	let { height } = $$props;
    	const dispatch = createEventDispatcher();

    	const handleKeydown = event => {
    		const newText = event.target.value;

    		if (text !== newText) {
    			$$invalidate(0, text = newText);
    			dispatch('input', text);
    		}
    	};

    	const writable_props = ['text', 'isMistake', 'height'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Form> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('text' in $$props) $$invalidate(0, text = $$props.text);
    		if ('isMistake' in $$props) $$invalidate(1, isMistake = $$props.isMistake);
    		if ('height' in $$props) $$invalidate(2, height = $$props.height);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		text,
    		isMistake,
    		height,
    		dispatch,
    		handleKeydown
    	});

    	$$self.$inject_state = $$props => {
    		if ('text' in $$props) $$invalidate(0, text = $$props.text);
    		if ('isMistake' in $$props) $$invalidate(1, isMistake = $$props.isMistake);
    		if ('height' in $$props) $$invalidate(2, height = $$props.height);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [text, isMistake, height, handleKeydown];
    }

    class Form extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { text: 0, isMistake: 1, height: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Form",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*text*/ ctx[0] === undefined && !('text' in props)) {
    			console.warn("<Form> was created without expected prop 'text'");
    		}

    		if (/*height*/ ctx[2] === undefined && !('height' in props)) {
    			console.warn("<Form> was created without expected prop 'height'");
    		}
    	}

    	get text() {
    		throw new Error("<Form>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set text(value) {
    		throw new Error("<Form>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get isMistake() {
    		throw new Error("<Form>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set isMistake(value) {
    		throw new Error("<Form>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Form>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Form>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App\Sample.svelte generated by Svelte v3.46.3 */

    const file$2 = "src\\App\\Sample.svelte";

    function create_fragment$2(ctx) {
    	let p;
    	let t;
    	let p_resize_listener;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t = text(/*samples*/ ctx[1]);
    			attr_dev(p, "translate", "no");
    			attr_dev(p, "class", "svelte-gmr2dp");
    			add_render_callback(() => /*p_elementresize_handler*/ ctx[2].call(p));
    			add_location(p, file$2, 4, 0, 83);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t);
    			p_resize_listener = add_resize_listener(p, /*p_elementresize_handler*/ ctx[2].bind(p));
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*samples*/ 2) set_data_dev(t, /*samples*/ ctx[1]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			p_resize_listener();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Sample', slots, []);
    	let { samples = '' } = $$props;
    	let { clientHeight } = $$props;
    	const writable_props = ['samples', 'clientHeight'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Sample> was created with unknown prop '${key}'`);
    	});

    	function p_elementresize_handler() {
    		clientHeight = this.clientHeight;
    		$$invalidate(0, clientHeight);
    	}

    	$$self.$$set = $$props => {
    		if ('samples' in $$props) $$invalidate(1, samples = $$props.samples);
    		if ('clientHeight' in $$props) $$invalidate(0, clientHeight = $$props.clientHeight);
    	};

    	$$self.$capture_state = () => ({ samples, clientHeight });

    	$$self.$inject_state = $$props => {
    		if ('samples' in $$props) $$invalidate(1, samples = $$props.samples);
    		if ('clientHeight' in $$props) $$invalidate(0, clientHeight = $$props.clientHeight);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [clientHeight, samples, p_elementresize_handler];
    }

    class Sample extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { samples: 1, clientHeight: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Sample",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*clientHeight*/ ctx[0] === undefined && !('clientHeight' in props)) {
    			console.warn("<Sample> was created without expected prop 'clientHeight'");
    		}
    	}

    	get samples() {
    		throw new Error("<Sample>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set samples(value) {
    		throw new Error("<Sample>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get clientHeight() {
    		throw new Error("<Sample>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set clientHeight(value) {
    		throw new Error("<Sample>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const getCharsStrings = (chars) => {
        // todo: parameters to add other names, replace space with char, capitalize etc
        return chars.map(charItem => `${charItem.names[0]} ${charItem.char}`);
    };
    const shuffleSattolo = (source) => {
        const result = [...source];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i - 1));
            [result[j], result[i]] = [result[i], result[j]];
        }
        return result;
    };
    const getCollection = (symbolsCollections, id) => symbolsCollections.find(collection => collection.id === id);
    const buildSample = (symbolsCollection) => {
        let result = getCharsStrings(symbolsCollection.symbols);
        result = shuffleSattolo(result);
        let resultString = result.join(' ');
        return resultString;
    };

    /* src\App\Sidebar.svelte generated by Svelte v3.46.3 */
    const file$1 = "src\\App\\Sidebar.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i].id;
    	child_ctx[5] = list[i].name;
    	child_ctx[6] = list[i].layout;
    	return child_ctx;
    }

    // (12:8) {#each symbolsCollections as {id, name, layout}}
    function create_each_block(ctx) {
    	let option;
    	let t0_value = /*layout*/ ctx[6] + "";
    	let t0;
    	let t1;
    	let t2_value = /*name*/ ctx[5] + "";
    	let t2;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t0 = text(t0_value);
    			t1 = text(": ");
    			t2 = text(t2_value);
    			option.__value = option_value_value = /*id*/ ctx[4];
    			option.value = option.__value;
    			add_location(option, file$1, 12, 12, 604);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t0);
    			append_dev(option, t1);
    			append_dev(option, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*symbolsCollections*/ 2 && t0_value !== (t0_value = /*layout*/ ctx[6] + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*symbolsCollections*/ 2 && t2_value !== (t2_value = /*name*/ ctx[5] + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*symbolsCollections*/ 2 && option_value_value !== (option_value_value = /*id*/ ctx[4])) {
    				prop_dev(option, "__value", option_value_value);
    				option.value = option.__value;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(12:8) {#each symbolsCollections as {id, name, layout}}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let sidebar;
    	let select;
    	let mounted;
    	let dispose;
    	let each_value = /*symbolsCollections*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			sidebar = element("sidebar");
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			if (/*selectedCollectionId*/ ctx[0] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[3].call(select));
    			add_location(select, file$1, 10, 4, 490);
    			add_location(sidebar, file$1, 9, 0, 475);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, sidebar, anchor);
    			append_dev(sidebar, select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select, null);
    			}

    			select_option(select, /*selectedCollectionId*/ ctx[0]);

    			if (!mounted) {
    				dispose = listen_dev(select, "change", /*select_change_handler*/ ctx[3]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*symbolsCollections*/ 2) {
    				each_value = /*symbolsCollections*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*selectedCollectionId, symbolsCollections*/ 3) {
    				select_option(select, /*selectedCollectionId*/ ctx[0]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(sidebar);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Sidebar', slots, []);
    	let { symbolsCollections } = $$props;
    	let { selectedCollectionId = symbolsCollections[0].id } = $$props;
    	let { sample = buildSample(getCollection(symbolsCollections, selectedCollectionId)) } = $$props;
    	const writable_props = ['symbolsCollections', 'selectedCollectionId', 'sample'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Sidebar> was created with unknown prop '${key}'`);
    	});

    	function select_change_handler() {
    		selectedCollectionId = select_value(this);
    		$$invalidate(0, selectedCollectionId);
    		$$invalidate(1, symbolsCollections);
    	}

    	$$self.$$set = $$props => {
    		if ('symbolsCollections' in $$props) $$invalidate(1, symbolsCollections = $$props.symbolsCollections);
    		if ('selectedCollectionId' in $$props) $$invalidate(0, selectedCollectionId = $$props.selectedCollectionId);
    		if ('sample' in $$props) $$invalidate(2, sample = $$props.sample);
    	};

    	$$self.$capture_state = () => ({
    		buildSample,
    		getCollection,
    		symbolsCollections,
    		selectedCollectionId,
    		sample
    	});

    	$$self.$inject_state = $$props => {
    		if ('symbolsCollections' in $$props) $$invalidate(1, symbolsCollections = $$props.symbolsCollections);
    		if ('selectedCollectionId' in $$props) $$invalidate(0, selectedCollectionId = $$props.selectedCollectionId);
    		if ('sample' in $$props) $$invalidate(2, sample = $$props.sample);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*symbolsCollections, selectedCollectionId*/ 3) {
    			$$invalidate(2, sample = buildSample(getCollection(symbolsCollections, selectedCollectionId)));
    		}
    	};

    	return [selectedCollectionId, symbolsCollections, sample, select_change_handler];
    }

    class Sidebar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
    			symbolsCollections: 1,
    			selectedCollectionId: 0,
    			sample: 2
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Sidebar",
    			options,
    			id: create_fragment$1.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*symbolsCollections*/ ctx[1] === undefined && !('symbolsCollections' in props)) {
    			console.warn("<Sidebar> was created without expected prop 'symbolsCollections'");
    		}
    	}

    	get symbolsCollections() {
    		throw new Error("<Sidebar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set symbolsCollections(value) {
    		throw new Error("<Sidebar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get selectedCollectionId() {
    		throw new Error("<Sidebar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set selectedCollectionId(value) {
    		throw new Error("<Sidebar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get sample() {
    		throw new Error("<Sidebar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set sample(value) {
    		throw new Error("<Sidebar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var Layout;
    (function (Layout) {
        Layout["QWERTY"] = "QWERTY";
        Layout["QWERTZ"] = "QWERTZ";
        Layout["AZERTY"] = "AZERTY";
    })(Layout || (Layout = {}));
    const symbolsConfig = [
        {
            id: 0,
            layout: Layout.QWERTY,
            name: 'Numbers Row',
            symbols: [
                { names: ['grave accent'], char: '`' },
                { names: ['tilde'], char: '~' },
                { names: ['exclamation mark', 'factorial', 'bang'], char: '!' },
                { names: ['at', 'commercial at'], char: '@' },
                { names: ['number', 'hash'], char: '#' },
                { names: ['dollar'], char: '$' },
                { names: ['percent'], char: '%' },
                { names: ['caret', 'circumflex accent'], char: '^' },
                { names: ['ampersand'], char: '&' },
                { names: ['asterisk', 'star'], char: '*' },
                { names: ['left parenthesis', 'opening parenthesis'], char: '(' },
                { names: ['right parenthesis', 'closing parenthesis'], char: ')' },
                { names: ['parentheses', 'parens', 'round brackets'], char: '()' },
                { names: ['low line'], char: '_' },
                { names: ['hyphen', 'minus', 'hyphen-minus'], char: '-' },
                { names: ['plus'], char: '+' },
                { names: ['equals'], char: '=' },
            ],
        },
        {
            id: 1,
            layout: Layout.QWERTY,
            name: 'Letter Rows',
            symbols: [
                { names: ['curly brackets', 'braces'], char: '{}' },
                { names: ['semicolon'], char: ';' },
                { names: ['colon'], char: ':' },
                { names: ['apostrophe', 'apostrophe-quote'], char: '\'' },
                { names: ['quotation'], char: '"' },
                { names: ['less-than'], char: '<' },
                { names: ['greater-than'], char: '>' },
                { names: ['square brackets'], char: '[]' },
                { names: ['reverse solidus', 'backslash'], char: '\\' },
                { names: ['vertical bar', 'vertical line'], char: '|' },
                { names: ['solidus', 'slash'], char: '/' },
            ],
        },
        {
            id: 2,
            layout: Layout.QWERTZ,
            name: 'Numbers Row T1',
            symbols: [
                { names: [''], char: '^' },
                { names: [''], char: '°' },
                { names: [''], char: '!' },
                { names: [''], char: '"' },
                { names: [''], char: '§' },
                { names: [''], char: '$' },
                { names: [''], char: '%' },
                { names: [''], char: '&' },
                { names: [''], char: '/' },
                { names: [''], char: '(' },
                { names: [''], char: ')' },
                { names: [''], char: '()' },
                { names: [''], char: '=' },
                { names: [''], char: '?' },
                { names: [''], char: '`' },
                { names: [''], char: 'ß' },
                { names: [''], char: '´' },
                { names: [''], char: '²' },
                { names: [''], char: '³' },
                { names: [''], char: '€' },
                { names: [''], char: '{' },
                { names: [''], char: '[' },
                { names: [''], char: ']' },
                { names: [''], char: '}' },
                { names: [''], char: '\\' },
                { names: [''], char: '' },
            ],
        },
        {
            id: 3,
            layout: Layout.QWERTZ,
            name: 'Letter Rows T1',
            symbols: [
                { names: [''], char: 'ü' },
                { names: [''], char: '+' },
                { names: [''], char: '*' },
                { names: [''], char: 'ö' },
                { names: [''], char: 'ä' },
                { names: [''], char: '#' },
                { names: [''], char: '\'' },
                { names: [''], char: ',' },
                { names: [''], char: '.' },
                { names: [''], char: '-' },
                { names: [''], char: ';' },
                { names: [''], char: ':' },
                { names: [''], char: '_' },
                { names: [''], char: '<' },
                { names: [''], char: '>' },
                { names: [''], char: '|' },
                { names: [''], char: '~' },
                { names: [''], char: 'µ' },
                { names: [''], char: '@' },
                { names: [''], char: '€' },
            ],
        },
    ];

    const instanceOfAny = (object, constructors) => constructors.some((c) => object instanceof c);

    let idbProxyableTypes;
    let cursorAdvanceMethods;
    // This is a function to prevent it throwing up in node environments.
    function getIdbProxyableTypes() {
        return (idbProxyableTypes ||
            (idbProxyableTypes = [
                IDBDatabase,
                IDBObjectStore,
                IDBIndex,
                IDBCursor,
                IDBTransaction,
            ]));
    }
    // This is a function to prevent it throwing up in node environments.
    function getCursorAdvanceMethods() {
        return (cursorAdvanceMethods ||
            (cursorAdvanceMethods = [
                IDBCursor.prototype.advance,
                IDBCursor.prototype.continue,
                IDBCursor.prototype.continuePrimaryKey,
            ]));
    }
    const cursorRequestMap = new WeakMap();
    const transactionDoneMap = new WeakMap();
    const transactionStoreNamesMap = new WeakMap();
    const transformCache = new WeakMap();
    const reverseTransformCache = new WeakMap();
    function promisifyRequest(request) {
        const promise = new Promise((resolve, reject) => {
            const unlisten = () => {
                request.removeEventListener('success', success);
                request.removeEventListener('error', error);
            };
            const success = () => {
                resolve(wrap(request.result));
                unlisten();
            };
            const error = () => {
                reject(request.error);
                unlisten();
            };
            request.addEventListener('success', success);
            request.addEventListener('error', error);
        });
        promise
            .then((value) => {
            // Since cursoring reuses the IDBRequest (*sigh*), we cache it for later retrieval
            // (see wrapFunction).
            if (value instanceof IDBCursor) {
                cursorRequestMap.set(value, request);
            }
            // Catching to avoid "Uncaught Promise exceptions"
        })
            .catch(() => { });
        // This mapping exists in reverseTransformCache but doesn't doesn't exist in transformCache. This
        // is because we create many promises from a single IDBRequest.
        reverseTransformCache.set(promise, request);
        return promise;
    }
    function cacheDonePromiseForTransaction(tx) {
        // Early bail if we've already created a done promise for this transaction.
        if (transactionDoneMap.has(tx))
            return;
        const done = new Promise((resolve, reject) => {
            const unlisten = () => {
                tx.removeEventListener('complete', complete);
                tx.removeEventListener('error', error);
                tx.removeEventListener('abort', error);
            };
            const complete = () => {
                resolve();
                unlisten();
            };
            const error = () => {
                reject(tx.error || new DOMException('AbortError', 'AbortError'));
                unlisten();
            };
            tx.addEventListener('complete', complete);
            tx.addEventListener('error', error);
            tx.addEventListener('abort', error);
        });
        // Cache it for later retrieval.
        transactionDoneMap.set(tx, done);
    }
    let idbProxyTraps = {
        get(target, prop, receiver) {
            if (target instanceof IDBTransaction) {
                // Special handling for transaction.done.
                if (prop === 'done')
                    return transactionDoneMap.get(target);
                // Polyfill for objectStoreNames because of Edge.
                if (prop === 'objectStoreNames') {
                    return target.objectStoreNames || transactionStoreNamesMap.get(target);
                }
                // Make tx.store return the only store in the transaction, or undefined if there are many.
                if (prop === 'store') {
                    return receiver.objectStoreNames[1]
                        ? undefined
                        : receiver.objectStore(receiver.objectStoreNames[0]);
                }
            }
            // Else transform whatever we get back.
            return wrap(target[prop]);
        },
        set(target, prop, value) {
            target[prop] = value;
            return true;
        },
        has(target, prop) {
            if (target instanceof IDBTransaction &&
                (prop === 'done' || prop === 'store')) {
                return true;
            }
            return prop in target;
        },
    };
    function replaceTraps(callback) {
        idbProxyTraps = callback(idbProxyTraps);
    }
    function wrapFunction(func) {
        // Due to expected object equality (which is enforced by the caching in `wrap`), we
        // only create one new func per func.
        // Edge doesn't support objectStoreNames (booo), so we polyfill it here.
        if (func === IDBDatabase.prototype.transaction &&
            !('objectStoreNames' in IDBTransaction.prototype)) {
            return function (storeNames, ...args) {
                const tx = func.call(unwrap(this), storeNames, ...args);
                transactionStoreNamesMap.set(tx, storeNames.sort ? storeNames.sort() : [storeNames]);
                return wrap(tx);
            };
        }
        // Cursor methods are special, as the behaviour is a little more different to standard IDB. In
        // IDB, you advance the cursor and wait for a new 'success' on the IDBRequest that gave you the
        // cursor. It's kinda like a promise that can resolve with many values. That doesn't make sense
        // with real promises, so each advance methods returns a new promise for the cursor object, or
        // undefined if the end of the cursor has been reached.
        if (getCursorAdvanceMethods().includes(func)) {
            return function (...args) {
                // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
                // the original object.
                func.apply(unwrap(this), args);
                return wrap(cursorRequestMap.get(this));
            };
        }
        return function (...args) {
            // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
            // the original object.
            return wrap(func.apply(unwrap(this), args));
        };
    }
    function transformCachableValue(value) {
        if (typeof value === 'function')
            return wrapFunction(value);
        // This doesn't return, it just creates a 'done' promise for the transaction,
        // which is later returned for transaction.done (see idbObjectHandler).
        if (value instanceof IDBTransaction)
            cacheDonePromiseForTransaction(value);
        if (instanceOfAny(value, getIdbProxyableTypes()))
            return new Proxy(value, idbProxyTraps);
        // Return the same value back if we're not going to transform it.
        return value;
    }
    function wrap(value) {
        // We sometimes generate multiple promises from a single IDBRequest (eg when cursoring), because
        // IDB is weird and a single IDBRequest can yield many responses, so these can't be cached.
        if (value instanceof IDBRequest)
            return promisifyRequest(value);
        // If we've already transformed this value before, reuse the transformed value.
        // This is faster, but it also provides object equality.
        if (transformCache.has(value))
            return transformCache.get(value);
        const newValue = transformCachableValue(value);
        // Not all types are transformed.
        // These may be primitive types, so they can't be WeakMap keys.
        if (newValue !== value) {
            transformCache.set(value, newValue);
            reverseTransformCache.set(newValue, value);
        }
        return newValue;
    }
    const unwrap = (value) => reverseTransformCache.get(value);

    /**
     * Open a database.
     *
     * @param name Name of the database.
     * @param version Schema version.
     * @param callbacks Additional callbacks.
     */
    function openDB(name, version, { blocked, upgrade, blocking, terminated } = {}) {
        const request = indexedDB.open(name, version);
        const openPromise = wrap(request);
        if (upgrade) {
            request.addEventListener('upgradeneeded', (event) => {
                upgrade(wrap(request.result), event.oldVersion, event.newVersion, wrap(request.transaction));
            });
        }
        if (blocked)
            request.addEventListener('blocked', () => blocked());
        openPromise
            .then((db) => {
            if (terminated)
                db.addEventListener('close', () => terminated());
            if (blocking)
                db.addEventListener('versionchange', () => blocking());
        })
            .catch(() => { });
        return openPromise;
    }

    const readMethods = ['get', 'getKey', 'getAll', 'getAllKeys', 'count'];
    const writeMethods = ['put', 'add', 'delete', 'clear'];
    const cachedMethods = new Map();
    function getMethod(target, prop) {
        if (!(target instanceof IDBDatabase &&
            !(prop in target) &&
            typeof prop === 'string')) {
            return;
        }
        if (cachedMethods.get(prop))
            return cachedMethods.get(prop);
        const targetFuncName = prop.replace(/FromIndex$/, '');
        const useIndex = prop !== targetFuncName;
        const isWrite = writeMethods.includes(targetFuncName);
        if (
        // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
        !(targetFuncName in (useIndex ? IDBIndex : IDBObjectStore).prototype) ||
            !(isWrite || readMethods.includes(targetFuncName))) {
            return;
        }
        const method = async function (storeName, ...args) {
            // isWrite ? 'readwrite' : undefined gzipps better, but fails in Edge :(
            const tx = this.transaction(storeName, isWrite ? 'readwrite' : 'readonly');
            let target = tx.store;
            if (useIndex)
                target = target.index(args.shift());
            // Must reject if op rejects.
            // If it's a write operation, must reject if tx.done rejects.
            // Must reject with op rejection first.
            // Must resolve with op value.
            // Must handle both promises (no unhandled rejections)
            return (await Promise.all([
                target[targetFuncName](...args),
                isWrite && tx.done,
            ]))[0];
        };
        cachedMethods.set(prop, method);
        return method;
    }
    replaceTraps((oldTraps) => ({
        ...oldTraps,
        get: (target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver),
        has: (target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop),
    }));

    const name = 'trainUrSkilz';
    const version = 2;
    var DbStores;
    (function (DbStores) {
        DbStores["symbolsCollection"] = "symbolsCollection";
        DbStores["stats"] = "stats";
    })(DbStores || (DbStores = {}));
    const upgradeDB = (db) => {
        if (db.objectStoreNames.contains(DbStores.symbolsCollection))
            return;
        const symbolsStore = db.createObjectStore(DbStores.symbolsCollection, {
            autoIncrement: true,
            keyPath: 'id',
        });
        symbolsStore.createIndex('byName', 'name');
        symbolsStore.createIndex('byLayout', 'layout');
    };
    const initDB = async () => await openDB(name, version, { upgrade: upgradeDB });
    const getSymbolsCollections = async () => {
        const db = await initDB();
        return await db.getAll(DbStores.symbolsCollection);
    };
    const storeDefaultSymbols = async () => {
        const db = await initDB();
        const tx = db.transaction(DbStores.symbolsCollection, 'readwrite');
        await Promise.all(symbolsConfig.map(symbolsCollection => tx.store.put(symbolsCollection)));
    };

    /* src\App\App.svelte generated by Svelte v3.46.3 */

    const { console: console_1 } = globals;
    const file = "src\\App\\App.svelte";

    // (1:0) <script lang="ts">import Form from "./Form.svelte";  import Sample from "./Sample.svelte";  import Sidebar from "./Sidebar.svelte";  import "./constants";  import { getSymbolsCollections }
    function create_catch_block(ctx) {
    	const block = {
    		c: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block.name,
    		type: "catch",
    		source: "(1:0) <script lang=\\\"ts\\\">import Form from \\\"./Form.svelte\\\";  import Sample from \\\"./Sample.svelte\\\";  import Sidebar from \\\"./Sidebar.svelte\\\";  import \\\"./constants\\\";  import { getSymbolsCollections }",
    		ctx
    	});

    	return block;
    }

    // (37:0) {:then collections}
    function create_then_block(ctx) {
    	let sidebar;
    	let updating_selectedCollectionId;
    	let updating_sample;
    	let current;

    	function sidebar_selectedCollectionId_binding(value) {
    		/*sidebar_selectedCollectionId_binding*/ ctx[7](value);
    	}

    	function sidebar_sample_binding(value) {
    		/*sidebar_sample_binding*/ ctx[8](value);
    	}

    	let sidebar_props = {
    		symbolsCollections: /*collections*/ ctx[12]
    	};

    	if (/*collectionId*/ ctx[3] !== void 0) {
    		sidebar_props.selectedCollectionId = /*collectionId*/ ctx[3];
    	}

    	if (/*sample*/ ctx[4] !== void 0) {
    		sidebar_props.sample = /*sample*/ ctx[4];
    	}

    	sidebar = new Sidebar({ props: sidebar_props, $$inline: true });
    	binding_callbacks.push(() => bind(sidebar, 'selectedCollectionId', sidebar_selectedCollectionId_binding));
    	binding_callbacks.push(() => bind(sidebar, 'sample', sidebar_sample_binding));

    	const block = {
    		c: function create() {
    			create_component(sidebar.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(sidebar, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const sidebar_changes = {};

    			if (!updating_selectedCollectionId && dirty & /*collectionId*/ 8) {
    				updating_selectedCollectionId = true;
    				sidebar_changes.selectedCollectionId = /*collectionId*/ ctx[3];
    				add_flush_callback(() => updating_selectedCollectionId = false);
    			}

    			if (!updating_sample && dirty & /*sample*/ 16) {
    				updating_sample = true;
    				sidebar_changes.sample = /*sample*/ ctx[4];
    				add_flush_callback(() => updating_sample = false);
    			}

    			sidebar.$set(sidebar_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(sidebar.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(sidebar.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(sidebar, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block.name,
    		type: "then",
    		source: "(37:0) {:then collections}",
    		ctx
    	});

    	return block;
    }

    // (35:27)      <p>...loading</p> {:then collections}
    function create_pending_block(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "...loading";
    			add_location(p, file, 35, 4, 1062);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block.name,
    		type: "pending",
    		source: "(35:27)      <p>...loading</p> {:then collections}",
    		ctx
    	});

    	return block;
    }

    // (41:0) {#if sample}
    function create_if_block(ctx) {
    	let main;
    	let form;
    	let updating_text;
    	let t;
    	let sample_1;
    	let updating_clientHeight;
    	let current;

    	function form_text_binding(value) {
    		/*form_text_binding*/ ctx[9](value);
    	}

    	let form_props = {
    		isMistake: /*isMistake*/ ctx[0],
    		height: /*sampleHeight*/ ctx[1]
    	};

    	if (/*formText*/ ctx[2] !== void 0) {
    		form_props.text = /*formText*/ ctx[2];
    	}

    	form = new Form({ props: form_props, $$inline: true });
    	binding_callbacks.push(() => bind(form, 'text', form_text_binding));
    	form.$on("input", /*handleInput*/ ctx[6]);

    	function sample_1_clientHeight_binding(value) {
    		/*sample_1_clientHeight_binding*/ ctx[10](value);
    	}

    	let sample_1_props = { samples: /*sample*/ ctx[4] };

    	if (/*sampleHeight*/ ctx[1] !== void 0) {
    		sample_1_props.clientHeight = /*sampleHeight*/ ctx[1];
    	}

    	sample_1 = new Sample({ props: sample_1_props, $$inline: true });
    	binding_callbacks.push(() => bind(sample_1, 'clientHeight', sample_1_clientHeight_binding));

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(form.$$.fragment);
    			t = space();
    			create_component(sample_1.$$.fragment);
    			attr_dev(main, "class", "svelte-1vxz9a1");
    			add_location(main, file, 41, 4, 1229);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(form, main, null);
    			append_dev(main, t);
    			mount_component(sample_1, main, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const form_changes = {};
    			if (dirty & /*isMistake*/ 1) form_changes.isMistake = /*isMistake*/ ctx[0];
    			if (dirty & /*sampleHeight*/ 2) form_changes.height = /*sampleHeight*/ ctx[1];

    			if (!updating_text && dirty & /*formText*/ 4) {
    				updating_text = true;
    				form_changes.text = /*formText*/ ctx[2];
    				add_flush_callback(() => updating_text = false);
    			}

    			form.$set(form_changes);
    			const sample_1_changes = {};
    			if (dirty & /*sample*/ 16) sample_1_changes.samples = /*sample*/ ctx[4];

    			if (!updating_clientHeight && dirty & /*sampleHeight*/ 2) {
    				updating_clientHeight = true;
    				sample_1_changes.clientHeight = /*sampleHeight*/ ctx[1];
    				add_flush_callback(() => updating_clientHeight = false);
    			}

    			sample_1.$set(sample_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(form.$$.fragment, local);
    			transition_in(sample_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(form.$$.fragment, local);
    			transition_out(sample_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(form);
    			destroy_component(sample_1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(41:0) {#if sample}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let header;
    	let h1;
    	let t1;
    	let t2;
    	let if_block_anchor;
    	let current;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: false,
    		pending: create_pending_block,
    		then: create_then_block,
    		catch: create_catch_block,
    		value: 12,
    		blocks: [,,,]
    	};

    	handle_promise(/*collectionsPromise*/ ctx[5], info);
    	let if_block = /*sample*/ ctx[4] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			header = element("header");
    			h1 = element("h1");
    			h1.textContent = "Train Ur Skilz!";
    			t1 = space();
    			info.block.c();
    			t2 = space();
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    			attr_dev(h1, "translate", "no");
    			attr_dev(h1, "class", "svelte-1vxz9a1");
    			set_style(h1, "opacity", /*formText*/ ctx[2].length > 0 ? '0.5' : '1', false);
    			add_location(h1, file, 30, 4, 916);
    			attr_dev(header, "class", "svelte-1vxz9a1");
    			add_location(header, file, 29, 0, 903);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, header, anchor);
    			append_dev(header, h1);
    			insert_dev(target, t1, anchor);
    			info.block.m(target, info.anchor = anchor);
    			info.mount = () => t2.parentNode;
    			info.anchor = t2;
    			insert_dev(target, t2, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			if (dirty & /*formText*/ 4) {
    				set_style(h1, "opacity", /*formText*/ ctx[2].length > 0 ? '0.5' : '1', false);
    			}

    			update_await_block_branch(info, ctx, dirty);

    			if (/*sample*/ ctx[4]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*sample*/ 16) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(info.block);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(header);
    			if (detaching) detach_dev(t1);
    			info.block.d(detaching);
    			info.token = null;
    			info = null;
    			if (detaching) detach_dev(t2);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let isMistake = false;
    	let sampleHeight;
    	let formText = '';
    	let collectionId = 0;
    	let sample = '';
    	console.log(sample);
    	const filterCollections = async () => await getSymbolsCollections();

    	// todo: move it to webworker
    	const collectionsPromise = filterCollections();

    	// const sampleText = shuffleSattolo(getCharsString(symbolsConfig[0].symbols)).join(' ')
    	const handleInput = event => {
    		const actual = event.detail;
    		const expected = sample.slice(0, actual.length);

    		if (actual !== expected) {
    			$$invalidate(0, isMistake = true);
    		} else {
    			$$invalidate(0, isMistake = false); // console.log(`"${actual}" !== "${expected}"`)
    		}
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function sidebar_selectedCollectionId_binding(value) {
    		collectionId = value;
    		$$invalidate(3, collectionId);
    	}

    	function sidebar_sample_binding(value) {
    		sample = value;
    		$$invalidate(4, sample);
    	}

    	function form_text_binding(value) {
    		formText = value;
    		$$invalidate(2, formText);
    	}

    	function sample_1_clientHeight_binding(value) {
    		sampleHeight = value;
    		$$invalidate(1, sampleHeight);
    	}

    	$$self.$capture_state = () => ({
    		Form,
    		Sample,
    		Sidebar,
    		getSymbolsCollections,
    		isMistake,
    		sampleHeight,
    		formText,
    		collectionId,
    		sample,
    		filterCollections,
    		collectionsPromise,
    		handleInput
    	});

    	$$self.$inject_state = $$props => {
    		if ('isMistake' in $$props) $$invalidate(0, isMistake = $$props.isMistake);
    		if ('sampleHeight' in $$props) $$invalidate(1, sampleHeight = $$props.sampleHeight);
    		if ('formText' in $$props) $$invalidate(2, formText = $$props.formText);
    		if ('collectionId' in $$props) $$invalidate(3, collectionId = $$props.collectionId);
    		if ('sample' in $$props) $$invalidate(4, sample = $$props.sample);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		isMistake,
    		sampleHeight,
    		formText,
    		collectionId,
    		sample,
    		collectionsPromise,
    		handleInput,
    		sidebar_selectedCollectionId_binding,
    		sidebar_sample_binding,
    		form_text_binding,
    		sample_1_clientHeight_binding
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
        target: document.body,
        props: {
        // name: 'world'
        }
    });
    storeDefaultSymbols();

    return app;

})();
//# sourceMappingURL=bundle.js.map
