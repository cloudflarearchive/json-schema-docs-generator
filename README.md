JSON Schema HTML Documentation Generator
=========================================

A flexible solution for auto-generating HTML API documentation from JSON-schemas that take advantage of the v4 Hyper-Schema definition. To use this package, you must have at least one valid JSON-schema file, preferably one that implements the `links` directive of the Hyper-Schema spec.

## What this package provides ##
For each `link` of a given schema, "endpoint" properties are added to the `link` definition, and provides additional data to be used for documentation purposes:

- `uri`: A resolved URI from the `href` attribute of the `link`, but simplifies any schema references to just the definition name. e.g., `/some/endpoint/{#/definitions/identifier}` => `/some/endpoint/:identifer`
- `parameters`: An object that contains an array of `required` parameters and `optional` parameters for the endpoint. Each array of items will typically contain `name`, `type`, `description`, and `example`, but is completely configurable.
- `curl`: A generated string containing an example cURL request for the endpoint. This will properly include schema information for all GET/POST/PUT/PATCH/DELETE methods. Currently this assumes JSON data types. All example data is pulled from `example` and/or `default` attributes for each property.
- `response`: An example response derived from the `targetSchema` of the `link`. All example data is pulled from `example` and/or `default` attributes for each property.

For each schema, a `definition` is provided, which contains either an array of `properties` (property definitions, just like endpoint parameters), or an array of `objects`, each of which is a `definition`. An array of objects will occur if you have an `anyOf` or `oneOf` case in your schema.

## How to use ##
To get started, you'll need to `json-schema-docs` config to your `package.json`. Below are the configuration options for the generator:

- `apiURL`: The base URL to build example cURL requests with
- `schemas`: An array of globs to resolve that will collect the schema files
- `dontParse`: An array of file paths relative to your package that might get picked up in the `schemas` globs, but shouldn't be parsed as JSON.
- `endpointOptions`: Options when building each endpoint
-- `attributeParameters` : An array of attribute names to include in the parameter map for each attribute
-- `curlHeaders`: Key/value map of flags and values to include with each example cURL request
- `noDocs`: An array of schema IDs that should no have documentation generated for it. This is useful if you're including all docs by default, but some schemas are just a basis for others and don't need HTML documentation.
- `templates`: An array of globs to resolve that will collect Handlebars template files
- `dist`: The directory/path where generated HTML files should be saved
- `pages`: An object where the key represents the HTML file name and the value is an array of schema IDs that should be included on that page. Optionally, a string of "*" can be used to include all schemas. (e.g., `{"index": "*"}`)
