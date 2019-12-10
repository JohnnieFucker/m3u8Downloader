module.exports = {
    "extends": "airbnb-base",
    "globals": {
        log: true,
        useMem: true,
    },
    "rules": {
        "indent": ["error", 4],
        "no-console": 0,
        "no-underscore-dangle": 0,
        "no-prototype-builtins": 0,
        "no-unused-vars":1,
        "no-use-before-define":0,
        "no-plusplus":0,
        "guard-for-in":2,
        "comma-dangle":[2, "never"],
        "no-param-reassign":0,
        "max-len":0,
        "no-dynamic-require":0,
        "object-shorthand":0,
        'no-restricted-syntax': [
            'error',
            // {
            //     selector: 'ForInStatement',
            //     message: 'for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.',
            // },
            // {
            //     selector: 'ForOfStatement',
            //     message: 'iterators/generators require regenerator-runtime, which is too heavyweight for this guide to allow them. Separately, loops should be avoided in favor of array iterations.',
            // },
            {
                selector: 'LabeledStatement',
                message: 'Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.',
            },
            {
                selector: 'WithStatement',
                message: '`with` is disallowed in strict mode because it makes code impossible to predict and optimize.',
            },
        ],
    }
};