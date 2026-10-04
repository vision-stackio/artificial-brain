import path from "path";
import { startClientBuild } from "../src/server/clientBuild";
startClientBuild(path.resolve(__dirname, ".."), { watch: false, minify: true }).then(() => console.log("browser bundle built -> dist/public"));
