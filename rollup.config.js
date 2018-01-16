import {minify} from "uglify-es"
import buble from "rollup-plugin-buble"
import commonjs from "rollup-plugin-commonjs"
import filesize from "rollup-plugin-filesize"
import resolve from "rollup-plugin-node-resolve"
import uglify from "rollup-plugin-uglify"

function getConfig(format) {
    const conf = {
        input: "src/index.js",
        output: {
            exports: "named",
            file: `dist/immer${format === "umd" ? ".umd" : ""}.js`,
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
            uglify(
                {
                    warnings: true,
                    toplevel: true
                },
                minify
            ),
            filesize()
        ]
    }

    return conf
}

const config = [getConfig("cjs"), getConfig("umd")]

export default config
