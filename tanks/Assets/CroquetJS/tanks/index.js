import { StartSession } from "@croquet/unity-bridge";
import { MyModelRoot } from "./Models";
import { MyViewRoot } from "./Pawns"

StartSession(MyModelRoot, MyViewRoot);
