import {minify} from "uglify-es"
import buble from "rollup-plugin-buble"
import commonjs from "rollup-plugin-commonjs"
import filesize from "rollup-plugin-filesize"
import resolve from "rollup-plugin-node-resolve"
import uglify from "rollup-plugin-uglify"

function getFileName(file, format) {
    if (format === "umd") {
        return `dist/${file}.umd.js`
    }

    return `dist/${file}.js`
}

function getConfig(input, file, format) {
    const conf = {
        input,
        output: {
            exports: "named",
            file: getFileName(file, format),
            format,
            name: "immer",
            sourcemap: true
        },
        plugins: [
            resolve({
                jsnext: true
            }),
            commonjs(),
            buble(),
            uglify({}, minify),
            filesize()
        ]
    }

    return conf
}

const config = [
    getConfig("src/es5.js", "es5", "cjs"),
    getConfig("src/es5.js", "es5", "umd"),
    getConfig("src/immer.js", "immer", "cjs"),
    getConfig("src/immer.js", "immer", "umd"),

    {
        input: "src/index.js",
        output: {
            file: "dist/index.js",
            format: "cjs"
        },
        plugins: [uglify({}, minify), filesize()]
    }
]

export default config
