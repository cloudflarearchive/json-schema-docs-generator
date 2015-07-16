JSON Schema HTML Documentation Generator
=========================================

A flexible solution for auto-generating HTML API documentation from JSON-schemas that take advantage of the v4 Hyper-Schema definition. To use this package, you must have at least one valid JSON-schema file, preferably one that implements the `links` definition of the Hyper-Schema spec.

## What this package provides ##
For each `link` of a given schema, "endpoint" properties are added to the `link` definition, and provides additional data to be used for documentation purposes:

- `uri`: A resolved URI from the `href` attribute of the `link`, but simplifies any schema references to just the definition name. e.g., `/some/endpoint/{#/definitions/identifier}` => `/some/endpoint/:identifer`
- `parameters`: An object that contains an array of `required` parameters and `optional` parameters for the endpoint. Each array of items will typically contain `name`, `type`, `description`, and `example`, but is completely configurable.
- `curl`: A generated string containing an example cURL request for the endpoint. This will properly include schema information for all GET/POST/PUT/PATCH/DELETE methods. Currently this assumes JSON data types. All example data is pulled from `example` or `default` attributes for each property.
- `response`: An example response derived from the `targetSchema` of the `link`. All example data is pulled from `example` and/or `default` attributes for each property.

For each schema, a `definition` is provided, which contains either an array of `properties` (property definitions, just like endpoint parameters), or an array of `objects`, each of which is a `definition` object. An array of objects will occur if you have an `anyOf` or `oneOf` case in your schema. Each definition object will also contain an `example` data object, stringified (JSON, by default)

## How to use ##
To get started, you'll need to `json-schema-docs` config to your `package.json`. Below are the configuration options for the generator:

- `apiURL`: The base URL to build example cURL requests with
- `schemas`: An array of globs to resolve that will collect the schema files
- `dontParse`: An array of file paths relative to your package that might get picked up in the `schemas` globs, but shouldn't be parsed as JSON. Useful for work-in-progress files that may be invalid JSON, but not worth fixing at the moment.
- `endpointOptions`: Options when building each endpoint
-- `attributeParameters` : An array of attribute names to include in the parameter map for each attribute
-- `curlHeaders`: Key/value map of flags and values to include with each example cURL request
-- `includeAdditionalProperties`: Boolean of whether or not to include additionalProperties defined in the schema when building example objects in requests/responses (default: true)
- `noDocs`: An array of schema IDs that should no have documentation generated for it. This is useful if you're including all docs by default, but some schemas are just a basis for others and don't need HTML documentation.
- `templates`: An array of globs to resolve that will collect Handlebars template files
- `templateOptions`: An object that will be passed in along with every page template that is generated. Useful for storing version numbers, or other metadata about your docs that you don't want to hard code in the template files.
- `destination`: The directory/path where generated HTML files should be saved (default location is `dist`)
- `pages`: An object where the key represents the HTML file name and the value is an array of schema IDs that should be included on that page. Optionally, a string of "*" can be used to include all schemas. (e.g., `{"index": "*"}`)

### Example configuration ###
Below is an example configuration in your `package.json`:

```javascript
{
  "json-schema-docs": {
    "apiURL": "https://api.example.com/version",
    "schemas": [
      "schemas/**/*.json"
    ],
    "dontParse": [
      "schemas/wip/work-in-progress-schema.json"
    ],
    "endpointOptions": {
      "attributes": ["title", "description", "method", "my_attribute_on_link_objects"],
      "attributeParameters": [
        "name",
        "type",
        "description",
        "example",
        "my_attribute_on_attribute_definitions"
      ],
      "curlHeaders": {
        "X-Auth-Token": "c2547eb745079dac9320b638f5e225cf483cc5cfdda41"
      }
    },
    "noDocs": [
      "/helpers/helper-schema1",
      "/helpers/helper-schema2",
    ],
    "templates": [
      "source/templates/*.handlebars"
    ],
    "destination": "./htdocs",
    "pages": {
      "index": [
        "/schema1-identifier",
        "/schema2-identifier"
      ]
    }
  }
}
```

## Rolling your own generator ##
A `bin` file comes packaged, but you can always write your own `bin` file to override any methods in the `Generator` class that you may need. Specifically, these options and utility methods may be of use to override:

- `_stringifyData (data, prettyPrint)`: The method used to stringify all example data object. Defaults to `JSON.stringify`, but you could override to display your data in any format.
- `getParameterFieldValue (name, definition, field)`: Defaults to just returning `definition[field]`, but if you have custom attributes in your attribute definitions that need a little more processing, you could override this method and check the provided attribute `name` to return a further processed value. Keys from the `attributeParameters` will be processed through here. For example, let's say you have a custom `field` that is a reference to another schema. You may want to build an example data object for that reference instead of just receiving the schema reference in your template.
- `compiler`: Default is to use Handlebars, but you can use your own via your own implementation

## To-dos ##
1. TESTS!
2. Better handling of page info for generating navigation across page templates
