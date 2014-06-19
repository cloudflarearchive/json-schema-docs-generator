// JSON Pointer implementation
// ===========================
// Modified from: Alexey Kuzmin <alex.s.kuzmin@gmail.com>
// see: http://tools.ietf.org/html/rfc6901
'use strict';

var _ = require('lodash'),
    pointer = {};

module.exports = pointer;

// A list of special characters and their escape sequences.
// Special characters will be unescaped in order they are listed.
// Section 3 of spec.
var specialChars = [
    ['/', '~1'],
    ['~', '~0']
];
// Token separator in JSON pointer string.
// Section 3 of spec.
var tokenSeparator = '/';
// Validates a pointer string.
var validPointerRegex = /(\/[^\/]*)+/;
// Possible errors during parsing
var ErrorMessage = {
    HYPHEN_IS_NOT_SUPPORTED_IN_ARRAY_CONTEXT:
            'Implementation does not support "-" token for arrays.',
    INVALID_DOCUMENT: 'JSON document is not valid.',
    INVALID_DOCUMENT_TYPE: 'JSON document must be a string or object.',
    INVALID_POINTER: 'Pointer is not valid.',
    NON_NUMBER_TOKEN_IN_ARRAY_CONTEXT:
            'Non-number tokens cannot be used in array context.',
    TOKEN_WITH_LEADING_ZERO_IN_ARRAY_CONTEXT:
            'Token with leading zero cannot be used in array context.'
};

// Returns target object's value pointed by pointer, returns undefined
// if |pointer| points to non-existing value.
// If pointer is not provided, validates first argument and returns
// evaluator function that takes pointer as argument.
// @param {(string|Object|Array)} target Evaluation target.
// @param {string=} pointer JSON Pointer string.
function getPointedValue(target, pointer) {
    // .get() method implementation.
    var evaluator;

    // First argument must be either string or object.
    if (_.isString(target)) {
        // If string it must be valid JSON document.
        try {
            // Let's try to parse it as JSON.
            target = JSON.parse(target);
        } catch (e) {
            // If parsing failed, an exception will be thrown.
            throw getError(ErrorMessage.INVALID_DOCUMENT);
        }
    // If not object or string, an exception will be thrown.
    } else if (!_.isPlainObject(target)) {
        throw getError(ErrorMessage.INVALID_DOCUMENT_TYPE);
    }

    // target is already parsed, create an evaluator for it.
    evaluator = createPointerEvaluator(target);

    // If no pointer was provided, return evaluator function.
    if (_.isUndefined(pointer)) {
        return evaluator;
    } else {
        return evaluator(pointer);
    }
}


/**
 * Returns function that takes JSON Pointer as single argument
 * and evaluates it in given |target| context.
 * Returned function throws an exception if pointer is not valid
 * or any error occurs during evaluation.
 * @param {*} target Evaluation target.
 * @returns {Function}
 */
function createPointerEvaluator(target) {
    // Use cache to store already received values.
    var cache = {};

    return function(pointer) {
        if (!isValidJSONPointer(pointer)) {
            // If it's not, an exception will be thrown.
            throw getError(ErrorMessage.INVALID_POINTER);
        }

        // First, look up in the cache.
        if (cache.hasOwnProperty(pointer)) {
            // If cache entry exists, return it's value.
            return cache[pointer];
        }

        // Now, when all arguments are valid, we can start evaluation.
        // First of all, let's convert JSON pointer string to tokens list.
        var tokensList = parsePointer(pointer);
        var token;
        var value = target;

        // Evaluation will be continued till tokens list is not empty
        // and returned value is not an undefined.
        while (!_.isUndefined(value) && !_.isUndefined(token = tokensList.pop())) {
            // Let's evaluate token in current context.
            // `getValue()` might throw an exception, but we won't handle it.
            value = getValue(value, token);
        }

        // Pointer evaluation is done, save value in the cache and return it.
        cache[pointer] = value;
        return value;
    };
}


// Validates JSON pointer string.
function isValidJSONPointer(pointer) {
    if (!_.isString(pointer)) {
        // If it's not a string, it obviously is not valid.
        return false;
    }

    if ('' === pointer) {
        // If it is string and is an empty string, it's valid.
        return true;
    }

    // If it is non-empty string, it must match spec defined format.
    // Check Section 3 of specification for concrete syntax.
    return validPointerRegex.test(pointer);
}


/**
 * Returns tokens list for given |pointer|. List is reversed, e.g.
 *     '/simple/path' -> ['path', 'simple']
 * @param {!string} pointer JSON pointer string.
 * @returns {Array} List of tokens.
 */
function parsePointer(pointer) {
    // Converts JSON pointer string into tokens list.

    // Let's split pointer string by tokens' separator character.
    // Also we will reverse resulting array to simplify it's further usage.
    var tokens = pointer.split(tokenSeparator).reverse();
    // Last item in resulting array is always an empty string,
    // we don't need it, let's remove it.
    tokens.pop();
    // Now tokens' array is ready to use, let's return it.
    return tokens;
}


/**
 * Decodes all escape sequences in given |rawReferenceToken|.
 * @param {!string} rawReferenceToken
 * @returns {string} Unescaped reference token.
 */
function unescapeReferenceToken(rawReferenceToken) {
    // Unescapes reference token. See Section 3 of specification.

    var referenceToken = rawReferenceToken;
    var character;
    var escapeSequence;
    var replaceRegExp;

    // Order of unescaping does matter.
    // That's why an array is used here and not hash.
    specialChars.forEach(function(pair) {
        character = pair[0];
        escapeSequence = pair[1];
        replaceRegExp = new RegExp(escapeSequence, 'g');
        referenceToken = referenceToken.replace(replaceRegExp, character);
    });

    return referenceToken;
}


/**
 * Returns value pointed by |token| in evaluation |context|.
 * Throws an exception if any error occurs.
 * @param {*} context Current evaluation context.
 * @param {!string} token Unescaped reference token.
 * @returns {*} Some value or undefined if value if not found.
 */
function getValue(context, token) {
    // Reference token evaluation. See Section 4 of spec.

    // First of all we should unescape all special characters in token.
    token = unescapeReferenceToken(token);

    // Further actions depend of context of evaluation.

    if (_.isArray(context)) {
        // In array context there are more strict requirements
        // for token value.

        if ('-' === token) {
            // Token cannot be a "-" character,
            // it has no sense in current implementation.
            throw getError(ErrorMessage.HYPHEN_IS_NOT_SUPPORTED_IN_ARRAY_CONTEXT);
        }
        if (!_.isNumber(token)) {
            // Token cannot be non-number.
            throw getError(ErrorMessage.NON_NUMBER_TOKEN_IN_ARRAY_CONTEXT);
        }
        if (token.length > 1 && '0' === token[0]) {
            // Token cannot be non-zero number with leading zero.
            throw getError(ErrorMessage.TOKEN_WITH_LEADING_ZERO_IN_ARRAY_CONTEXT);
        }
        // If all conditions are met, simply return element
        // with token's value index.
        // It might be undefined, but it's ok.
        return context[token];
    }

    if (_.isPlainObject(context)) {
        // In object context we can simply return element w/ key equal to token.
        // It might be undefined, but it's ok.
        return context[token];
    }

    // If context is not an array or an object,
    // token evaluation is not possible.
    // This is the expected situation and so we won't throw an error,
    // undefined value is perfectly suitable here.
    return;
}

function getError (message) {
    return new Error('JSON pointer: '+message);
}

pointer.get = getPointedValue;
