/*
 * ok so do I want to represent this data as a context tree node, or a page?
 * Technically, it is a context tree? but also not exactly. the context tree is *just* context objects.
 * this is more like pages. but also not everything is a page. some things are asset dirs, or whatever.
 * I'm going to reword my classes and docs. Tartan creates a tree, side effects of the tree are (sometimes) pages.
 * So, is it a context tree or some other kind of other tree. Some other tree. I think. for now I could literally just call it a tartan tree lol.
 */

import { Observable, of, ReplaySubject, Subject, SubjectLike } from "rxjs";
import { FullTartanContext, PartialTartanContext } from "./tartan-context.js";

/**
 * Representation of a context tree node.
 */
class Node {
    /**
     * Whether this node is currently attached to the tree
     */
    protected readonly _attached: Subject<boolean>;
    public get attached(): Observable<boolean> {
        return this._attached;
    }
    /**
     * The children of this node
     */
    protected readonly _children: Subject<Set<Node>>;
    public get children(): Observable<Set<Node>> {
        return this._children;
    }
    /**
     * The fully initialized context object associated with this node
     */
    public context: Observable<FullTartanContext>;

    /**
     * The context object that child nodes will inherit from
     */
    private inheritableContext: Observable<PartialTartanContext>;
    private partialContext: Observable<PartialTartanContext>;

    /**
     * Any side effects of this node
     */
    public sideEffects: Observable<SideEffect[]>;

    constructor(
        path: string,
        /**
         * Tell me how to know I'm attached
         */
        attached: Observable<boolean>,
        inheritContextFrom: Observable<PartialTartanContext>,
    ) {
        this._attached = new ReplaySubject();
        attached.subscribe((val) => this._attached.next(val));
    }
}

interface SideEffect {
    result: Observable<any>;
}

class Page implements SideEffect {
    result: Observable<any>;
    constructor() {
        this.result = of("Hi");
    }
}

class Asset implements SideEffect {
    result: Observable<any>;
    constructor() {
        this.result = of("");
    }
}

class Handoff implements SideEffect {
    result: Observable<any>;
    constructor() {
        this.result = of("");
    }
}
