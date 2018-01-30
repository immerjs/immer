import {minify} from "uglify-es"
import commonjs from "rollup-plugin-commonjs"
import filesize from "rollup-plugin-filesize"
import resolve from "rollup-plugin-node-resolve"
import uglify from "rollup-plugin-uglify"
import babel from "rollup-plugin-babel"

function getConfig(dest, format, ugly) {
    const conf = {
        input: "src/immer.js",
        output: {
            exports: "named",
            file: dest,
            format,
            name: "immer",
            sourcemap: true
        },
        plugins: [
            resolve({
                jsnext: true
            }),
            commonjs(),
            babel({
                babelrc: false,
                presets: [
                    [
                        "env",
                        {
                            modules: false
                        }
                    ]
                ],
                plugins: ["external-helpers"]
            }),
            ugly &&
                uglify(
                    {
                        warnings: true,
                        toplevel: true,
                        sourceMap: true,
                        mangle: {
                            properties: false /* {
                                    reserved: [
                                        "module",
                                        "exports",
                                        "default",
                                        "value", // for the esModule = true defintion
                                        "setUseProxies",
                                        "setAutoFreeze"
                                    ]
                                } */
                        }
                    },
                    minify
                ),
            filesize()
        ].filter(Boolean)
    }

    return conf
}

const config = [
    getConfig("dist/immer.js", "cjs", false),
    getConfig("dist/immer.umd.js", "umd", true),
    getConfig("dist/immer.module.js", "es", false)
]

export default config
