using UnityEngine;

public class GameState : MonoBehaviour, ICroquetDriven
{
    public int redScore;
    public int blueScore;
    public int redPlayers;
    public int bluePlayers;
    public bool gameEnded;

    public static void StateRestart()
    {
        Debug.Log("Button press");
        GameState currentState = null;
        GameObject gameStateGO = GameObject.FindWithTag("GameController");
        if (gameStateGO != null)
        {
            currentState = gameStateGO.GetComponent<GameState>();
        }

        if (currentState == null)
        {
            Debug.LogWarning("Error getting the gamestate");
            return;
        }

        Debug.Log("Restarting game");
        currentState.GameRestart();
    }

    void Awake()
    {
        Croquet.Listen(gameObject, "redScoreSet", RedScoreSet);
        Croquet.Listen(gameObject, "blueScoreSet", BlueScoreSet);
        Croquet.Listen(gameObject, "redPlayersSet", RedPlayersSet);
        Croquet.Listen(gameObject, "bluePlayersSet", BluePlayersSet);
        Croquet.Listen(gameObject, "gameEndedSet", GameEndedSet);
    }

    public void PawnInitializationComplete()
    {
        RedScoreSet(Croquet.ReadActorFloat(gameObject, "redScore"));
        BlueScoreSet(Croquet.ReadActorFloat(gameObject, "blueScore"));
        RedPlayersSet(Croquet.ReadActorFloat(gameObject, "redPlayers"));
        BluePlayersSet(Croquet.ReadActorFloat(gameObject, "bluePlayers"));
        GameEndedSet(Croquet.ReadActorBool(gameObject, "gameEnded"));
    }

    public void GameRestart() {
        Debug.Log("Restarting state");
        Croquet.Say(gameObject, "restartGame");
    }

    void RedScoreSet(float redScore)
    {
        this.redScore = (int)redScore;
    }

    void BlueScoreSet(float blueScore)
    {
        this.blueScore = (int)blueScore;
    }

    void RedPlayersSet(float redPlayers)
    {
        this.redPlayers = (int)redPlayers;
    }

    void BluePlayersSet(float bluePlayers)
    {
        this.bluePlayers = (int)bluePlayers;
    }

    void GameEndedSet(bool gameEnded)
    {
        this.gameEnded = gameEnded;
    }
}
