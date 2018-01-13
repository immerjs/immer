import {minify} from "uglify-es"
import babel from "rollup-plugin-babel"
import commonjs from "rollup-plugin-commonjs"
import filesize from "rollup-plugin-filesize"
import resolve from "rollup-plugin-node-resolve"
import uglify from "rollup-plugin-uglify"

const format = process.env.NODE_ENV
const isUmd = format === "umd"

function getFileName(file) {
    if (isUmd) {
        return `dist/${file}.umd.js`
    }

    return `dist/${file}.js`
}

function getConfig(input, file) {
    const conf = {
        input,
        output: {
            exports: "named",
            file: getFileName(file),
            format: process.env.NODE_ENV,
            name: "immer",
            sourcemap: true
        },
        plugins: [
            resolve({
                jsnext: true
            }),
            commonjs(),
            babel({
                presets: [["es2015", {modules: false}]],
                exclude: "node_modules/**"
            }),
            uglify({}, minify),
            filesize()
        ]
    }

    return conf
}

const config = [
    getConfig("src/es5.js", "es5"),
    getConfig("src/immer.js", "immer"),
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
