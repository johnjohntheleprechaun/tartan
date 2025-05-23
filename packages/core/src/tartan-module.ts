/*
 * @format
 */
import { Package } from "custom-elements-manifest";
import { TemplateManifest } from "./template-manifest.js";

/**
 * This is an internal type used to structure all the things a tartan module can provide.
 * The data is constructed from information from custom-elements-manifest and my own defined template-manifest
 */
export interface TartanModule {
    /**
     * The custom-element-manifest provided.
     */
    componentManifest?: Package;
    /**
     * The template manifest found in the module
     */
    templateManifest?: TemplateManifest;
}
