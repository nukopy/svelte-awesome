function noop() { }
function assign(tar, src) {
    // @ts-ignore
    for (const k in src)
        tar[k] = src[k];
    return tar;
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
function create_slot(definition, ctx, $$scope, fn) {
    if (definition) {
        const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
        return definition[0](slot_ctx);
    }
}
function get_slot_context(definition, ctx, $$scope, fn) {
    return definition[1] && fn
        ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
        : $$scope.ctx;
}
function get_slot_changes(definition, $$scope, dirty, fn) {
    if (definition[2] && fn) {
        const lets = definition[2](fn(dirty));
        if ($$scope.dirty === undefined) {
            return lets;
        }
        if (typeof lets === 'object') {
            const merged = [];
            const len = Math.max($$scope.dirty.length, lets.length);
            for (let i = 0; i < len; i += 1) {
                merged[i] = $$scope.dirty[i] | lets[i];
            }
            return merged;
        }
        return $$scope.dirty | lets;
    }
    return $$scope.dirty;
}
function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
    if (slot_changes) {
        const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
        slot.p(slot_context, slot_changes);
    }
}
function get_all_dirty_from_scope($$scope) {
    if ($$scope.ctx.length > 32) {
        const dirty = [];
        const length = $$scope.ctx.length / 32;
        for (let i = 0; i < length; i++) {
            dirty[i] = -1;
        }
        return dirty;
    }
    return -1;
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
function svg_element(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
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
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function set_svg_attributes(node, attributes) {
    for (const key in attributes) {
        attr(node, key, attributes[key]);
    }
}
function children(element) {
    return Array.from(element.childNodes);
}
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}

let current_component;
function set_current_component(component) {
    current_component = component;
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
let flushing = false;
const seen_callbacks = new Set();
function flush() {
    if (flushing)
        return;
    flushing = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
            const component = dirty_components[i];
            set_current_component(component);
            update(component.$$);
        }
        set_current_component(null);
        dirty_components.length = 0;
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
    flushing = false;
    seen_callbacks.clear();
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

function get_spread_update(levels, updates) {
    const update = {};
    const to_null_out = {};
    const accounted_for = { $$scope: 1 };
    let i = levels.length;
    while (i--) {
        const o = levels[i];
        const n = updates[i];
        if (n) {
            for (const key in o) {
                if (!(key in n))
                    to_null_out[key] = 1;
            }
            for (const key in n) {
                if (!accounted_for[key]) {
                    update[key] = n[key];
                    accounted_for[key] = 1;
                }
            }
            levels[i] = n;
        }
        else {
            for (const key in o) {
                accounted_for[key] = 1;
            }
        }
    }
    for (const key in to_null_out) {
        if (!(key in update))
            update[key] = undefined;
    }
    return update;
}

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
        context: new Map(parent_component ? parent_component.$$.context : options.context || []),
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

/* src/components/svg/Path.svelte generated by Svelte v3.41.0 */

function create_fragment$4(ctx) {
	let path;
	let path_key_value;

	let path_levels = [
		{
			key: path_key_value = "path-" + /*id*/ ctx[0]
		},
		/*data*/ ctx[1]
	];

	let path_data = {};

	for (let i = 0; i < path_levels.length; i += 1) {
		path_data = assign(path_data, path_levels[i]);
	}

	return {
		c() {
			path = svg_element("path");
			set_svg_attributes(path, path_data);
		},
		m(target, anchor) {
			insert(target, path, anchor);
		},
		p(ctx, [dirty]) {
			set_svg_attributes(path, path_data = get_spread_update(path_levels, [
				dirty & /*id*/ 1 && path_key_value !== (path_key_value = "path-" + /*id*/ ctx[0]) && { key: path_key_value },
				dirty & /*data*/ 2 && /*data*/ ctx[1]
			]));
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(path);
		}
	};
}

function instance$4($$self, $$props, $$invalidate) {
	let { id = '' } = $$props;
	let { data = {} } = $$props;

	$$self.$$set = $$props => {
		if ('id' in $$props) $$invalidate(0, id = $$props.id);
		if ('data' in $$props) $$invalidate(1, data = $$props.data);
	};

	return [id, data];
}

class Path extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$4, create_fragment$4, safe_not_equal, { id: 0, data: 1 });
	}
}

/* src/components/svg/Polygon.svelte generated by Svelte v3.41.0 */

function create_fragment$3(ctx) {
	let polygon;
	let polygon_key_value;

	let polygon_levels = [
		{
			key: polygon_key_value = "polygon-" + /*id*/ ctx[0]
		},
		/*data*/ ctx[1]
	];

	let polygon_data = {};

	for (let i = 0; i < polygon_levels.length; i += 1) {
		polygon_data = assign(polygon_data, polygon_levels[i]);
	}

	return {
		c() {
			polygon = svg_element("polygon");
			set_svg_attributes(polygon, polygon_data);
		},
		m(target, anchor) {
			insert(target, polygon, anchor);
		},
		p(ctx, [dirty]) {
			set_svg_attributes(polygon, polygon_data = get_spread_update(polygon_levels, [
				dirty & /*id*/ 1 && polygon_key_value !== (polygon_key_value = "polygon-" + /*id*/ ctx[0]) && { key: polygon_key_value },
				dirty & /*data*/ 2 && /*data*/ ctx[1]
			]));
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(polygon);
		}
	};
}

function instance$3($$self, $$props, $$invalidate) {
	let { id = '' } = $$props;
	let { data = {} } = $$props;

	$$self.$$set = $$props => {
		if ('id' in $$props) $$invalidate(0, id = $$props.id);
		if ('data' in $$props) $$invalidate(1, data = $$props.data);
	};

	return [id, data];
}

class Polygon extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$3, create_fragment$3, safe_not_equal, { id: 0, data: 1 });
	}
}

/* src/components/svg/Raw.svelte generated by Svelte v3.41.0 */

function create_fragment$2(ctx) {
	let g;

	return {
		c() {
			g = svg_element("g");
		},
		m(target, anchor) {
			insert(target, g, anchor);
			g.innerHTML = /*raw*/ ctx[0];
		},
		p(ctx, [dirty]) {
			if (dirty & /*raw*/ 1) g.innerHTML = /*raw*/ ctx[0];		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(g);
		}
	};
}

function instance$2($$self, $$props, $$invalidate) {
	let cursor = 0xd4937;

	function getId() {
		cursor += 1;
		return `fa-${cursor.toString(16)}`;
	}

	let raw;
	let { data } = $$props;

	function getRaw(data) {
		if (!data || !data.raw) {
			return null;
		}

		let rawData = data.raw;
		const ids = {};

		rawData = rawData.replace(/\s(?:xml:)?id=["']?([^"')\s]+)/g, (match, id) => {
			const uniqueId = getId();
			ids[id] = uniqueId;
			return ` id="${uniqueId}"`;
		});

		rawData = rawData.replace(/#(?:([^'")\s]+)|xpointer\(id\((['"]?)([^')]+)\2\)\))/g, (match, rawId, _, pointerId) => {
			const id = rawId || pointerId;

			if (!id || !ids[id]) {
				return match;
			}

			return `#${ids[id]}`;
		});

		return rawData;
	}

	$$self.$$set = $$props => {
		if ('data' in $$props) $$invalidate(1, data = $$props.data);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*data*/ 2) {
			$$invalidate(0, raw = getRaw(data));
		}
	};

	return [raw, data];
}

class Raw extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$2, create_fragment$2, safe_not_equal, { data: 1 });
	}
}

/* src/components/svg/Svg.svelte generated by Svelte v3.41.0 */

function create_fragment$1(ctx) {
	let svg;
	let svg_class_value;
	let svg_role_value;
	let current;
	const default_slot_template = /*#slots*/ ctx[13].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[12], null);

	return {
		c() {
			svg = svg_element("svg");
			if (default_slot) default_slot.c();
			attr(svg, "version", "1.1");
			attr(svg, "class", svg_class_value = "fa-icon " + /*className*/ ctx[0] + " svelte-1dof0an");
			attr(svg, "x", /*x*/ ctx[8]);
			attr(svg, "y", /*y*/ ctx[9]);
			attr(svg, "width", /*width*/ ctx[1]);
			attr(svg, "height", /*height*/ ctx[2]);
			attr(svg, "aria-label", /*label*/ ctx[11]);
			attr(svg, "role", svg_role_value = /*label*/ ctx[11] ? 'img' : 'presentation');
			attr(svg, "viewBox", /*box*/ ctx[3]);
			attr(svg, "style", /*style*/ ctx[10]);
			toggle_class(svg, "fa-spin", /*spin*/ ctx[4]);
			toggle_class(svg, "fa-pulse", /*pulse*/ ctx[6]);
			toggle_class(svg, "fa-inverse", /*inverse*/ ctx[5]);
			toggle_class(svg, "fa-flip-horizontal", /*flip*/ ctx[7] === 'horizontal');
			toggle_class(svg, "fa-flip-vertical", /*flip*/ ctx[7] === 'vertical');
		},
		m(target, anchor) {
			insert(target, svg, anchor);

			if (default_slot) {
				default_slot.m(svg, null);
			}

			current = true;
		},
		p(ctx, [dirty]) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 4096)) {
					update_slot_base(
						default_slot,
						default_slot_template,
						ctx,
						/*$$scope*/ ctx[12],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[12])
						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[12], dirty, null),
						null
					);
				}
			}

			if (!current || dirty & /*className*/ 1 && svg_class_value !== (svg_class_value = "fa-icon " + /*className*/ ctx[0] + " svelte-1dof0an")) {
				attr(svg, "class", svg_class_value);
			}

			if (!current || dirty & /*x*/ 256) {
				attr(svg, "x", /*x*/ ctx[8]);
			}

			if (!current || dirty & /*y*/ 512) {
				attr(svg, "y", /*y*/ ctx[9]);
			}

			if (!current || dirty & /*width*/ 2) {
				attr(svg, "width", /*width*/ ctx[1]);
			}

			if (!current || dirty & /*height*/ 4) {
				attr(svg, "height", /*height*/ ctx[2]);
			}

			if (!current || dirty & /*label*/ 2048) {
				attr(svg, "aria-label", /*label*/ ctx[11]);
			}

			if (!current || dirty & /*label*/ 2048 && svg_role_value !== (svg_role_value = /*label*/ ctx[11] ? 'img' : 'presentation')) {
				attr(svg, "role", svg_role_value);
			}

			if (!current || dirty & /*box*/ 8) {
				attr(svg, "viewBox", /*box*/ ctx[3]);
			}

			if (!current || dirty & /*style*/ 1024) {
				attr(svg, "style", /*style*/ ctx[10]);
			}

			if (dirty & /*className, spin*/ 17) {
				toggle_class(svg, "fa-spin", /*spin*/ ctx[4]);
			}

			if (dirty & /*className, pulse*/ 65) {
				toggle_class(svg, "fa-pulse", /*pulse*/ ctx[6]);
			}

			if (dirty & /*className, inverse*/ 33) {
				toggle_class(svg, "fa-inverse", /*inverse*/ ctx[5]);
			}

			if (dirty & /*className, flip*/ 129) {
				toggle_class(svg, "fa-flip-horizontal", /*flip*/ ctx[7] === 'horizontal');
			}

			if (dirty & /*className, flip*/ 129) {
				toggle_class(svg, "fa-flip-vertical", /*flip*/ ctx[7] === 'vertical');
			}
		},
		i(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(svg);
			if (default_slot) default_slot.d(detaching);
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	let { class: className } = $$props;
	let { width } = $$props;
	let { height } = $$props;
	let { box } = $$props;
	let { spin = false } = $$props;
	let { inverse = false } = $$props;
	let { pulse = false } = $$props;
	let { flip = null } = $$props;
	let { x = undefined } = $$props;
	let { y = undefined } = $$props;
	let { style = undefined } = $$props;
	let { label = undefined } = $$props;

	$$self.$$set = $$props => {
		if ('class' in $$props) $$invalidate(0, className = $$props.class);
		if ('width' in $$props) $$invalidate(1, width = $$props.width);
		if ('height' in $$props) $$invalidate(2, height = $$props.height);
		if ('box' in $$props) $$invalidate(3, box = $$props.box);
		if ('spin' in $$props) $$invalidate(4, spin = $$props.spin);
		if ('inverse' in $$props) $$invalidate(5, inverse = $$props.inverse);
		if ('pulse' in $$props) $$invalidate(6, pulse = $$props.pulse);
		if ('flip' in $$props) $$invalidate(7, flip = $$props.flip);
		if ('x' in $$props) $$invalidate(8, x = $$props.x);
		if ('y' in $$props) $$invalidate(9, y = $$props.y);
		if ('style' in $$props) $$invalidate(10, style = $$props.style);
		if ('label' in $$props) $$invalidate(11, label = $$props.label);
		if ('$$scope' in $$props) $$invalidate(12, $$scope = $$props.$$scope);
	};

	return [
		className,
		width,
		height,
		box,
		spin,
		inverse,
		pulse,
		flip,
		x,
		y,
		style,
		label,
		$$scope,
		slots
	];
}

class Svg extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance$1, create_fragment$1, safe_not_equal, {
			class: 0,
			width: 1,
			height: 2,
			box: 3,
			spin: 4,
			inverse: 5,
			pulse: 6,
			flip: 7,
			x: 8,
			y: 9,
			style: 10,
			label: 11
		});
	}
}

/* src/components/Icon.svelte generated by Svelte v3.41.0 */

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[24] = list[i];
	child_ctx[26] = i;
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[27] = list[i];
	child_ctx[26] = i;
	return child_ctx;
}

// (4:4) {#if self}
function create_if_block(ctx) {
	let t0;
	let t1;
	let if_block2_anchor;
	let current;
	let if_block0 = /*self*/ ctx[0].paths && create_if_block_3(ctx);
	let if_block1 = /*self*/ ctx[0].polygons && create_if_block_2(ctx);
	let if_block2 = /*self*/ ctx[0].raw && create_if_block_1(ctx);

	return {
		c() {
			if (if_block0) if_block0.c();
			t0 = space();
			if (if_block1) if_block1.c();
			t1 = space();
			if (if_block2) if_block2.c();
			if_block2_anchor = empty();
		},
		m(target, anchor) {
			if (if_block0) if_block0.m(target, anchor);
			insert(target, t0, anchor);
			if (if_block1) if_block1.m(target, anchor);
			insert(target, t1, anchor);
			if (if_block2) if_block2.m(target, anchor);
			insert(target, if_block2_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (/*self*/ ctx[0].paths) {
				if (if_block0) {
					if_block0.p(ctx, dirty);

					if (dirty & /*self*/ 1) {
						transition_in(if_block0, 1);
					}
				} else {
					if_block0 = create_if_block_3(ctx);
					if_block0.c();
					transition_in(if_block0, 1);
					if_block0.m(t0.parentNode, t0);
				}
			} else if (if_block0) {
				group_outros();

				transition_out(if_block0, 1, 1, () => {
					if_block0 = null;
				});

				check_outros();
			}

			if (/*self*/ ctx[0].polygons) {
				if (if_block1) {
					if_block1.p(ctx, dirty);

					if (dirty & /*self*/ 1) {
						transition_in(if_block1, 1);
					}
				} else {
					if_block1 = create_if_block_2(ctx);
					if_block1.c();
					transition_in(if_block1, 1);
					if_block1.m(t1.parentNode, t1);
				}
			} else if (if_block1) {
				group_outros();

				transition_out(if_block1, 1, 1, () => {
					if_block1 = null;
				});

				check_outros();
			}

			if (/*self*/ ctx[0].raw) {
				if (if_block2) {
					if_block2.p(ctx, dirty);

					if (dirty & /*self*/ 1) {
						transition_in(if_block2, 1);
					}
				} else {
					if_block2 = create_if_block_1(ctx);
					if_block2.c();
					transition_in(if_block2, 1);
					if_block2.m(if_block2_anchor.parentNode, if_block2_anchor);
				}
			} else if (if_block2) {
				group_outros();

				transition_out(if_block2, 1, 1, () => {
					if_block2 = null;
				});

				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block0);
			transition_in(if_block1);
			transition_in(if_block2);
			current = true;
		},
		o(local) {
			transition_out(if_block0);
			transition_out(if_block1);
			transition_out(if_block2);
			current = false;
		},
		d(detaching) {
			if (if_block0) if_block0.d(detaching);
			if (detaching) detach(t0);
			if (if_block1) if_block1.d(detaching);
			if (detaching) detach(t1);
			if (if_block2) if_block2.d(detaching);
			if (detaching) detach(if_block2_anchor);
		}
	};
}

// (5:6) {#if self.paths}
function create_if_block_3(ctx) {
	let each_1_anchor;
	let current;
	let each_value_1 = /*self*/ ctx[0].paths;
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
		},
		m(target, anchor) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(target, anchor);
			}

			insert(target, each_1_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (dirty & /*self*/ 1) {
				each_value_1 = /*self*/ ctx[0].paths;
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block_1(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
					}
				}

				group_outros();

				for (i = each_value_1.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value_1.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			destroy_each(each_blocks, detaching);
			if (detaching) detach(each_1_anchor);
		}
	};
}

// (6:8) {#each self.paths as path, i}
function create_each_block_1(ctx) {
	let path;
	let current;

	path = new Path({
			props: {
				id: /*i*/ ctx[26],
				data: /*path*/ ctx[27]
			}
		});

	return {
		c() {
			create_component(path.$$.fragment);
		},
		m(target, anchor) {
			mount_component(path, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const path_changes = {};
			if (dirty & /*self*/ 1) path_changes.data = /*path*/ ctx[27];
			path.$set(path_changes);
		},
		i(local) {
			if (current) return;
			transition_in(path.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(path.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(path, detaching);
		}
	};
}

// (10:6) {#if self.polygons}
function create_if_block_2(ctx) {
	let each_1_anchor;
	let current;
	let each_value = /*self*/ ctx[0].polygons;
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			each_1_anchor = empty();
		},
		m(target, anchor) {
			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(target, anchor);
			}

			insert(target, each_1_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (dirty & /*self*/ 1) {
				each_value = /*self*/ ctx[0].polygons;
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			destroy_each(each_blocks, detaching);
			if (detaching) detach(each_1_anchor);
		}
	};
}

// (11:8) {#each self.polygons as polygon, i}
function create_each_block(ctx) {
	let polygon;
	let current;

	polygon = new Polygon({
			props: {
				id: /*i*/ ctx[26],
				data: /*polygon*/ ctx[24]
			}
		});

	return {
		c() {
			create_component(polygon.$$.fragment);
		},
		m(target, anchor) {
			mount_component(polygon, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const polygon_changes = {};
			if (dirty & /*self*/ 1) polygon_changes.data = /*polygon*/ ctx[24];
			polygon.$set(polygon_changes);
		},
		i(local) {
			if (current) return;
			transition_in(polygon.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(polygon.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(polygon, detaching);
		}
	};
}

// (15:6) {#if self.raw}
function create_if_block_1(ctx) {
	let raw;
	let updating_data;
	let current;

	function raw_data_binding(value) {
		/*raw_data_binding*/ ctx[15](value);
	}

	let raw_props = {};

	if (/*self*/ ctx[0] !== void 0) {
		raw_props.data = /*self*/ ctx[0];
	}

	raw = new Raw({ props: raw_props });
	binding_callbacks.push(() => bind(raw, 'data', raw_data_binding));

	return {
		c() {
			create_component(raw.$$.fragment);
		},
		m(target, anchor) {
			mount_component(raw, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const raw_changes = {};

			if (!updating_data && dirty & /*self*/ 1) {
				updating_data = true;
				raw_changes.data = /*self*/ ctx[0];
				add_flush_callback(() => updating_data = false);
			}

			raw.$set(raw_changes);
		},
		i(local) {
			if (current) return;
			transition_in(raw.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(raw.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(raw, detaching);
		}
	};
}

// (3:8)      
function fallback_block(ctx) {
	let if_block_anchor;
	let current;
	let if_block = /*self*/ ctx[0] && create_if_block(ctx);

	return {
		c() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (/*self*/ ctx[0]) {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty & /*self*/ 1) {
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
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if (if_block) if_block.d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

// (1:0) <Svg label={label} width={width} height={height} box={box} style={combinedStyle}   spin={spin} flip={flip} inverse={inverse} pulse={pulse} class={className}>
function create_default_slot(ctx) {
	let current;
	const default_slot_template = /*#slots*/ ctx[14].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[16], null);
	const default_slot_or_fallback = default_slot || fallback_block(ctx);

	return {
		c() {
			if (default_slot_or_fallback) default_slot_or_fallback.c();
		},
		m(target, anchor) {
			if (default_slot_or_fallback) {
				default_slot_or_fallback.m(target, anchor);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 65536)) {
					update_slot_base(
						default_slot,
						default_slot_template,
						ctx,
						/*$$scope*/ ctx[16],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[16])
						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[16], dirty, null),
						null
					);
				}
			} else {
				if (default_slot_or_fallback && default_slot_or_fallback.p && (!current || dirty & /*self*/ 1)) {
					default_slot_or_fallback.p(ctx, !current ? -1 : dirty);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(default_slot_or_fallback, local);
			current = true;
		},
		o(local) {
			transition_out(default_slot_or_fallback, local);
			current = false;
		},
		d(detaching) {
			if (default_slot_or_fallback) default_slot_or_fallback.d(detaching);
		}
	};
}

function create_fragment(ctx) {
	let svg;
	let current;

	svg = new Svg({
			props: {
				label: /*label*/ ctx[6],
				width: /*width*/ ctx[7],
				height: /*height*/ ctx[8],
				box: /*box*/ ctx[10],
				style: /*combinedStyle*/ ctx[9],
				spin: /*spin*/ ctx[2],
				flip: /*flip*/ ctx[5],
				inverse: /*inverse*/ ctx[3],
				pulse: /*pulse*/ ctx[4],
				class: /*className*/ ctx[1],
				$$slots: { default: [create_default_slot] },
				$$scope: { ctx }
			}
		});

	return {
		c() {
			create_component(svg.$$.fragment);
		},
		m(target, anchor) {
			mount_component(svg, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const svg_changes = {};
			if (dirty & /*label*/ 64) svg_changes.label = /*label*/ ctx[6];
			if (dirty & /*width*/ 128) svg_changes.width = /*width*/ ctx[7];
			if (dirty & /*height*/ 256) svg_changes.height = /*height*/ ctx[8];
			if (dirty & /*box*/ 1024) svg_changes.box = /*box*/ ctx[10];
			if (dirty & /*combinedStyle*/ 512) svg_changes.style = /*combinedStyle*/ ctx[9];
			if (dirty & /*spin*/ 4) svg_changes.spin = /*spin*/ ctx[2];
			if (dirty & /*flip*/ 32) svg_changes.flip = /*flip*/ ctx[5];
			if (dirty & /*inverse*/ 8) svg_changes.inverse = /*inverse*/ ctx[3];
			if (dirty & /*pulse*/ 16) svg_changes.pulse = /*pulse*/ ctx[4];
			if (dirty & /*className*/ 2) svg_changes.class = /*className*/ ctx[1];

			if (dirty & /*$$scope, self*/ 65537) {
				svg_changes.$$scope = { dirty, ctx };
			}

			svg.$set(svg_changes);
		},
		i(local) {
			if (current) return;
			transition_in(svg.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(svg.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(svg, detaching);
		}
	};
}
let outerScale = 1;

function normaliseData(data) {
	if ('iconName' in data && 'icon' in data) {
		let normalisedData = {};
		let faIcon = data.icon;
		let name = data.iconName;
		let width = faIcon[0];
		let height = faIcon[1];
		let paths = faIcon[4];
		let iconData = { width, height, paths: [{ d: paths }] };
		normalisedData[name] = iconData;
		return normalisedData;
	}

	return data;
}

function instance($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	let { class: className = "" } = $$props;
	let { data } = $$props;
	let { scale = 1 } = $$props;
	let { spin = false } = $$props;
	let { inverse = false } = $$props;
	let { pulse = false } = $$props;
	let { flip = null } = $$props;
	let { label = null } = $$props;
	let { self = null } = $$props;
	let { style = null } = $$props;
	let width;
	let height;
	let combinedStyle;
	let box;

	function init() {
		if (typeof data === 'undefined') {
			return;
		}

		const normalisedData = normaliseData(data);
		const [name] = Object.keys(normalisedData);
		const icon = normalisedData[name];

		if (!icon.paths) {
			icon.paths = [];
		}

		if (icon.d) {
			icon.paths.push({ d: icon.d });
		}

		if (!icon.polygons) {
			icon.polygons = [];
		}

		if (icon.points) {
			icon.polygons.push({ points: icon.points });
		}

		$$invalidate(0, self = icon);
	}

	function normalisedScale() {
		let numScale = 1;

		if (typeof scale !== 'undefined') {
			numScale = Number(scale);
		}

		if (isNaN(numScale) || numScale <= 0) {
			// eslint-disable-line no-restricted-globals
			console.warn('Invalid prop: prop "scale" should be a number over 0.'); // eslint-disable-line no-console

			return outerScale;
		}

		return numScale * outerScale;
	}

	function calculateBox() {
		if (self) {
			return `0 0 ${self.width} ${self.height}`;
		}

		return `0 0 ${width} ${height}`;
	}

	function calculateRatio() {
		if (!self) {
			return 1;
		}

		return Math.max(self.width, self.height) / 16;
	}

	function calculateWidth() {

		if (self) {
			return self.width / calculateRatio() * normalisedScale();
		}

		return 0;
	}

	function calculateHeight() {

		if (self) {
			return self.height / calculateRatio() * normalisedScale();
		}

		return 0;
	}

	function calculateStyle() {
		let combined = "";

		if (style !== null) {
			combined += style;
		}

		let size = normalisedScale();

		if (size === 1) {
			if (combined.length === 0) {
				return undefined;
			}

			return combined;
		}

		if (combined !== "" && !combined.endsWith(';')) {
			combined += '; ';
		}

		return `${combined}font-size: ${size}em`;
	}

	function raw_data_binding(value) {
		self = value;
		$$invalidate(0, self);
	}

	$$self.$$set = $$props => {
		if ('class' in $$props) $$invalidate(1, className = $$props.class);
		if ('data' in $$props) $$invalidate(11, data = $$props.data);
		if ('scale' in $$props) $$invalidate(12, scale = $$props.scale);
		if ('spin' in $$props) $$invalidate(2, spin = $$props.spin);
		if ('inverse' in $$props) $$invalidate(3, inverse = $$props.inverse);
		if ('pulse' in $$props) $$invalidate(4, pulse = $$props.pulse);
		if ('flip' in $$props) $$invalidate(5, flip = $$props.flip);
		if ('label' in $$props) $$invalidate(6, label = $$props.label);
		if ('self' in $$props) $$invalidate(0, self = $$props.self);
		if ('style' in $$props) $$invalidate(13, style = $$props.style);
		if ('$$scope' in $$props) $$invalidate(16, $$scope = $$props.$$scope);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*data, style, scale*/ 14336) {
			{
				init();
				$$invalidate(7, width = calculateWidth());
				$$invalidate(8, height = calculateHeight());
				$$invalidate(9, combinedStyle = calculateStyle());
				$$invalidate(10, box = calculateBox());
			}
		}
	};

	return [
		self,
		className,
		spin,
		inverse,
		pulse,
		flip,
		label,
		width,
		height,
		combinedStyle,
		box,
		data,
		scale,
		style,
		slots,
		raw_data_binding,
		$$scope
	];
}

class Icon extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance, create_fragment, safe_not_equal, {
			class: 1,
			data: 11,
			scale: 12,
			spin: 2,
			inverse: 3,
			pulse: 4,
			flip: 5,
			label: 6,
			self: 0,
			style: 13
		});
	}
}

export { Icon as default };
