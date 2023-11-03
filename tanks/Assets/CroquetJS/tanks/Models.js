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
const missileSpeed = 75;

class MissileActor extends mix(Actor).with(AM_Spatial, AM_Behavioral) {
        get gamePawnType() { return "missile" }

        get color() { return this._color || [0.5, 0.5, 0.5] }

        init(options) {
                super.init(options);
                this.future(2000).destroy(); // destroy after some time
                this.tick();
        }

        tick() {
                this.test();
                if (!this.doomed) this.future(10).tick();
        }

        test() {
                const tank = this.parent.pingAny("tank", this.translation, 4, this);
                if (tank) {
                        console.log("hit");
                        if ((this.color[0] === tank.color[0] && this.color[0] === 1) ||
                                (this.color[2] === tank.color[2] && this.color[2] === 1)) return;
                        const d2 = v_dist2Sqr(this.translation, tank.translation);
                        if (d2 < 4) { // bot radius is 2
                                tank.destroy();
                                // console.log(`bot ${bot.id} hit at distance ${Math.sqrt(d2).toFixed(2)}`);
                                this.destroy();
                                return;
                        }
                }
        }
}
MissileActor.register('MissileActor');

//------------------------------------------------------------------------------------------
//-- AvatarActor ----------------------------------------------------------------------------
//------------------------------------------------------------------------------------------

// AvatarActor includes the AM_Avatar mixin.  Avatars have a driver property that holds the viewId of the user controlling them.

class AvatarActor extends mix(Actor).with(AM_Spatial, AM_Avatar, AM_OnGrid) {
        get gamePawnType() { return "tank" }

        get color() { return this._color || [0.5, 0.5, 0.5] }

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
                        color: this.color
                });
                missile.go = missile.behavior.start({
                        name: "GoBehavior",
                        aim,
                        speed: missileSpeed,
                        tickRate: 20
                });
                missile.ballisticVelocity = aim.map(val => val * missileSpeed);
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
                this.props = new Map();
                this.propsTimeout = 60 * 60 * 1000; // 1 hour
        }

        get defaultUser() { return MyUser }

        createUser(options) {
                const { userId } = options;
                // restore saved props
                const saved = this.props.get(userId);
                if (saved) {
                        options = { ...options, savedProps: saved.props };
                        this.props.delete(userId);
                }
                // delete old saved props
                const expired = this.now() - this.propsTimeout;
                for (const [uid, { lastSeen }] of this.props) {
                        if (lastSeen < expired) {
                                this.props.delete(uid);
                        }
                }
                return super.createUser(options);
        }

        destroyUser(user) {
                const props = user.saveProps();
                if (props) {
                        this.props.set(user.userId, { props, lastSeen: this.now() });
                }
                super.destroyUser(user);
        }
}
MyUserManager.register('MyUserManager');

// When someone joins a session, a new user is created for them. When it starts up, the user creates
// an avatar that only that person can use. We randomly generate a color for the user, so we'll be able


const distance = 25;
const fixedAngle = Math.PI / 2.0;

class MyUser extends User {
        init(options) {
                super.init(options);
                const base = this.wellKnownModel("ModelRoot").base;
                const rndm = this.random();
                var translation = [0, 0, 0];
                var angle = fixedAngle;
                if (rndm < 0.5) { // Blue team
                        this.color = [rndm, rndm, 1];
                        translation = [- distance, 0, 0];
                } else { // Red team
                        this.color = [1, rndm, rndm];
                        translation = [distance, 0, 0];
                        angle = - angle;
                }
                const props = options.savedProps || {
                        translation,
                        rotation: q_axisAngle([0, 1, 0], angle),
                        color: this.color
                };
                this.avatar = AvatarActor.create({
                        tags: ["avatar", "tank"],
                        parent: base,
                        driver: this.userId,
                        ...props
                });
                AvatarActor.create({
                        tags: ["avatar", "tank"],
                        parent: base,
                        driver: this.userId,
                        color: [0, 0, 0],
                        translation: [0, 0, 0],
                });
        }

        saveProps() {
                const { color, translation, rotation } = this.avatar;
                return { color, translation, rotation };
        }

        destroy() {
                super.destroy();
                if (this.avatar) this.avatar.destroy();
        }

}
MyUser.register('MyUser');


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
        }

}
MyModelRoot.register("MyModelRoot");
