// Tutorial 8 Models

import { Actor, mix, AM_Grid, AM_OnGrid, AM_Spatial, UserManager, User, AM_Avatar, AM_Behavioral, q_axisAngle, v3_rotate } from "@croquet/worldcore-kernel";
import { GameModelRoot } from "@croquet/game-models";

const v_dist2Sqr = function(a, b) {
        const dx = a[0] - b[0];
        const dy = a[2] - b[2];
        return dx * dx + dy * dy;
};

//------------------------------------------------------------------------------------------
//-- BaseActor -----------------------------------------------------------------------------
//------------------------------------------------------------------------------------------

class BaseActor extends mix(Actor).with(AM_Spatial, AM_Grid) {
        get gamePawnType() { return "groundPlane" }

        init(options) {
                super.init(options);
        }

}
BaseActor.register('BaseActor');


//------------------------------------------------------------------------------------------
//--MissileActor ---------------------------------------------------------------------------
// Fired by the tank - they destroy the bots but bounce off of everything else
//------------------------------------------------------------------------------------------

class MissileActor extends mix(Actor).with(AM_Spatial, AM_Behavioral) {
        get gamePawnType() { return "missile" }

        get color() { return this._color || [0.5, 0.5, 0.5] }
        get team() { return this._team || "" }

        init(options) {
                super.init(options);
                this.subscribe(options.team, "destroyBullets", this.destroyBullets);
                this.future(3000).destroy();
                this.tick();
        }

        tick() {
                this.test();
                if (!this.doomed) this.future(10).tick();
        }

        test() {
                const tank = this.parent.pingAny("tank", this.translation, 4, this);
                if (tank) {
                        if (this.team === tank.team || tank.team === "spectator") return;
                        const d2 = v_dist2Sqr(this.translation, tank.translation);
                        if (d2 < 4) { // bot radius is 2
                                const userId = tank.driver;
                                const state = this.wellKnownModel("ModelRoot").state;
                                state.score(this.team);
                                this.publish(userId, "playerKilled");
                                tank.killMe();
                                // console.log(`bot ${bot.id} hit at distance ${Math.sqrt(d2).toFixed(2)}`);
                                this.destroy();
                                return;
                        }
                }
        }

        destroyBullets(gradient) {
                if (this.color[1] === gradient) {
                        this.destroy();
                }
        }
}
MissileActor.register('MissileActor');

//------------------------------------------------------------------------------------------
//-- AvatarActor ----------------------------------------------------------------------------
//------------------------------------------------------------------------------------------

// AvatarActor includes the AM_Avatar mixin.  Avatars have a driver property that holds the viewId of the user controlling them.

const missileSpeed = 50;

class AvatarActor extends mix(Actor).with(AM_Spatial, AM_Avatar, AM_OnGrid) {
        get gamePawnType() { return "tank" }

        get color() { return this._color || [0.5, 0.5, 0.5] }
        get team() { return this._team || "" }

        init(options) {
                super.init(options);
                this.isAvatar = true;
                this.listen("shoot", this.doShoot);
        }

        doShoot(argFloats) {
                // view is now expected to set the launch location, given that the launcher
                // can compensate for its own velocity
                const [x, y, z, yaw] = argFloats;
                const translation = [x, y + 0.5, z];
                const aim = v3_rotate([0, 0, 1], q_axisAngle([0, 1, 0], yaw));
                const missile = MissileActor.create({
                        parent: this.parent,
                        translation,
                        color: this.color,
                        team: this.team,
                });
                missile.go = missile.behavior.start({
                        name: "GoBehavior",
                        aim,
                        speed: missileSpeed,
                        tickRate: 20,
                });
                missile.ballisticVelocity = aim.map(val => val * missileSpeed);
        }


        killMe() {
                this.destroy();
        }
}
AvatarActor.register('AvatarActor');

//------------------------------------------------------------------------------------------
//-- Users ---------------------------------------------------------------------------------
//------------------------------------------------------------------------------------------

// UserManager is a model-side service that creates a special user actor whenever someone joins
// the session. You can query the UserManager to get a list of all current users, but right now
// we're going to use the user system to spawn an avatar.

class MyUserManager extends UserManager {
        init() {
                super.init();
        }

        get defaultUser() { return MyUser }

        createUser(options) {
                const { userId } = options;
                const state = this.wellKnownModel("ModelRoot").state;
                options = { ...options, stateProps: state.createPlayer(userId) }
                // delete old saved props
                return super.createUser(options);
        }

        destroyUser(user) {
                const userId = user.userId;
                const state = this.wellKnownModel("ModelRoot").state;
                state.destroyPlayer(userId);
                super.destroyUser(user);
        }
}
MyUserManager.register('MyUserManager');

// When someone joins a session, a new user is created for them. When it starts up, the user creates
// an avatar that only that person can use. We randomly generate a color for the user, so we'll be able


class MyUser extends User {
        init(options) {
                super.init(options);
                const props = options.stateProps.userProps;
                const waiting = options.stateProps.waiting;
                if (!waiting) {
                        const base = this.wellKnownModel("ModelRoot").base;
                        this.avatar = AvatarActor.create({
                                tags: ["avatar", "tank"],
                                parent: base,
                                driver: this.userId,
                                ...props
                        });
                        if (props.team === "red" || props.team === "blue") {
                                this.publish(props.gradient, "updatePair", true);
                        }
                } else {
                        this.avatar = null;
                }
                this.noSpawn = false;
                this.set({ props });
                if (props.team === "red" || props.team === "blue") {
                        this.subscribe(props.gradient, "updatePair", this.updatePair);
                        this.subscribe(this.userId, "playerKilled", this.killed);
                }
                this.subscribe("all", "gameEnded", this.gameEnded);
                this.subscribe("users", "restartGame", this.respawn);
        }

        get props() { return this._props }

        updatePair(create) {
                if (create) {
                        const props = this.props;
                        const base = this.wellKnownModel("ModelRoot").base;
                        this.avatar = AvatarActor.create({
                                tags: ["avatar", "tank"],
                                parent: base,
                                driver: this.userId,
                                ...props
                        });
                } else if (this.avatar) {
                        this.avatar.destroy();
                        this.avatar = null;
                        const gradient = this.props.gradient;
                        const team = this.props.team;
                        this.publish(team, "destroyBullets", gradient);
                }
        }

        killed() {
                this.avatar = null;
                this.future(2000).respawn();
        }

        respawn() {
                if (this.avatar || this.noSpawn) return;
                const props = this.props;
                const base = this.wellKnownModel("ModelRoot").base;
                this.avatar = AvatarActor.create({
                        tags: ["avatar", "tank"],
                        parent: base,
                        driver: this.userId,
                        ...props
                });
        }

        gameEnded() {
                this.noSpawn = true;
                if (this.avatar) {
                        const gradient = this.props.gradient;
                        const team = this.props.team;
                        this.publish(team, "destroyBullets", gradient);
                        this.avatar.killMe();
                        this.avatar = null;
                }
        }

        destroy() {
                const team = this.props.team;
                if (team === "red" || team === "blue") {
                        const gradient = this.props.gradient;
                        this.publish(team, "destroyBullets", gradient);
                        this.publish(gradient, "updatePair", false);
                }
                super.destroy();
                if (this.avatar) this.avatar.destroy();
        }
}
MyUser.register('MyUser');

//------------------------------------------------------------------------------------------
//-- GameStateActor ------------------------------------------------------------------------
// Manage global game state.
//------------------------------------------------------------------------------------------

const distance = 25;
const offsetDistance = 7;
const fixedAngle = Math.PI / 2.0;
const gradients = [0, 0.275, 0.549]
const finalScore = 5;

class GameStateActor extends Actor {
        get gamePawnType() { return "gamestate" }

        init(options) {
                super.init(options);
                this.props = new Map();
                this.blue = [];
                this.red = [];
                this.redScore = 0;
                this.blueScore = 0;
                this.redPlayers = 0;
                this.bluePlayers = 0;
                this.spectators = 0;
                this.gameEnded = false;
                this.listen("restartGame", this.restartGame);
        }


        score(team) {
                switch (team) {
                        case "red":
                                this.redScore++;
                                break;
                        case "blue":
                                this.blueScore++;
                                break;
                        default:
                                console.log("Unable to score");
                }
                if (this.blueScore >= finalScore || this.redScore >= finalScore) {
                        this.gameEnded = true;
                        this.publish("all", "gameEnded");
                }
        }

        calculateOffset(off) {
                return - (offsetDistance * 2) + offsetDistance * (off);
        }

        createPlayer(userId) {
                const blue_len = this.blue.length;
                const red_len = this.red.length;
                if (blue_len === 3 && red_len === 3) { // Spectator
                        this.props.set(userId, {
                                team: "spectator",
                                gradient: 0,
                                color: [0, 0, 0],
                                translation: [0, 0, -20],
                                rotation: [0, 0, 0],
                        });
                } else if (blue_len <= red_len) { // Blue
                        const gradient = gradients.filter(x => !this.blue.includes(x))[0];
                        this.blue.push(gradient);
                        const offset = this.calculateOffset(this.blue.length);
                        this.props.set(userId, {
                                team: "blue",
                                gradient,
                                color: [gradient, gradient, 1],
                                translation: [-distance, 0, offset],
                                rotation: q_axisAngle([0, 1, 0], fixedAngle),
                        });
                        this.bluePlayers++;
                } else { // Red
                        const gradient = gradients.filter(x => !this.red.includes(x))[0];
                        this.red.push(gradient);
                        const offset = this.calculateOffset(this.red.length);
                        this.props.set(userId, {
                                team: "red",
                                gradient,
                                color: [1, gradient, gradient],
                                translation: [distance, 0, offset],
                                rotation: q_axisAngle([0, 1, 0], -fixedAngle),
                        });
                        this.redPlayers++;
                }

                return {
                        userProps: this.props.get(userId),
                        waiting: this.red.length != this.blue.length,
                };
        }

        destroyPlayer(userId) {
                let i = 0;
                const { team, gradient } = this.props.get(userId);
                switch (team) {
                        case "blue":
                                i = this.blue.indexOf(gradient);
                                this.blue.splice(i, 1);
                                this.bluePlayers--;
                                break;
                        case "red":
                                i = this.red.indexOf(gradient);
                                this.red.splice(i, 1);
                                this.redPlayers--;
                                break;
                        case "spectator":
                                this.spectators--;
                                break;
                        default:
                                console.log("Unknow team user");
                }
                this.props.delete(userId);
        }

        restartGame() {
                console.log("restarting game");
                this.redScore = 0;
                this.blueScore = 0;
                this.gameEnded = false;
                this.publish("users", "restartGame");
        }
}
GameStateActor.register('GameStateActor');

//------------------------------------------------------------------------------------------
//-- MyModelRoot ---------------------------------------------------------------------------
//------------------------------------------------------------------------------------------

export class MyModelRoot extends GameModelRoot {

        static modelServices() {
                return [MyUserManager, ...super.modelServices()];
        }

        init(options) {
                super.init(options);
                console.log("Start model root!");
                this.base = BaseActor.create();
                this.state = GameStateActor.create();
        }

}
MyModelRoot.register("MyModelRoot");
