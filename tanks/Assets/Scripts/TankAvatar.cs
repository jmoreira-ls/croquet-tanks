using UnityEngine;

public class TankAvatar : MonoBehaviour, ICroquetDriven
{
    public float speed;
    public string team;
    public bool destroyed;

    private float lastShootTime = 0;
    private float waitShootTime = 0.25f; // 250ms
    private float distanceLimit = 15.0f;

    private int croquetHandle;
    private GameState gameState;
    private CroquetAvatarComponent avatarComponent;

    void Awake()
    {
        Croquet.Listen(gameObject, "teamSet", TeamSet);
        Croquet.Listen(gameObject, "destroyedSet", DestroyedSet);
    }

    public void PawnInitializationComplete()
    {
        TeamSet(Croquet.ReadActorString(gameObject, "team"));
        croquetHandle = gameObject.GetComponent<CroquetEntityComponent>().croquetHandle;
        avatarComponent = gameObject.GetComponent<CroquetAvatarComponent>();
    }

    void TeamSet(string team)
    {
        this.team = team;
    }

    void DestroyedSet(bool destroyed)
    {
        this.destroyed = destroyed;
    }

    void Update()
    {
        if (avatarComponent == null) return;

        if (gameState == null)
        {
            GameObject gameStateGO = GameObject.FindWithTag("GameController");
            if (gameStateGO != null)
            {
                gameState = gameStateGO.GetComponent<GameState>();
            }

            if (gameState == null) return;
        }

        if (CroquetAvatarSystem.Instance.GetActiveAvatarComponent() == avatarComponent && !gameState.gameEnded)
        {
            if (team == "red" || team == "blue")
            {
                float pos = transform.position.z;
                float vertical = Input.GetAxis("Vertical");
                float speedNow = 0.0f;
                if (!((pos > distanceLimit && vertical > 0.0f) || (pos < -distanceLimit && vertical < 0.0f)))
                {
                    speedNow = speed * vertical;
                }
                Drive(speedNow);
                Shoot(speedNow);
            }
        }
    }

    void Drive(float speed)
    {
        /*
            // from Worldcore tutorial8:
            const yaw = (this.right+this.left) * -3 * delta/1000;
            const yawQ = q_axisAngle([0,1,0], yaw);
            const rotation = q_multiply(this.rotation, yawQ);
            const t = v3_scale([0, 0, (this.fore + this.back)], 5 * delta/1000);
            const tt = v3_rotate(t, rotation);
            let translation = v3_add(this.translation, tt);
            this.positionTo(translation, rotation);
         */

        transform.Translate(Vector3.forward * (speed * Time.deltaTime), Space.World);

        CroquetSpatialSystem.Instance.SnapObjectTo(croquetHandle, transform.position, transform.rotation);
        CroquetSpatialSystem.Instance.SnapObjectInCroquet(croquetHandle, transform.position, transform.rotation);
    }

    void Shoot(float speed)
    {
        float now = Time.realtimeSinceStartup;
        if (now - lastShootTime < waitShootTime) return;

        if (Input.GetKeyDown(KeyCode.Space))
        {
            lastShootTime = now;

            Quaternion q = transform.rotation;
            // yaw is in radians
            float yaw = Mathf.Atan2(2 * q.y * q.w - 2 * q.x * q.z, 1 - 2 * q.y * q.y - 2 * q.z * q.z);

            Vector3 pos = (speed * 0.02f + 2.0f) * transform.forward + transform.position; // position in 50ms' time
            float[] args = { pos.x, pos.y, pos.z, yaw };
            Croquet.Say(gameObject, "shoot", args);
        }
    }
}
