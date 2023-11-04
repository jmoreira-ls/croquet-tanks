using System.Collections;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UIElements;

public class HUDController : MonoBehaviour
{
    public TMP_Text redScoreText;
    public TMP_Text blueScoreText;
    public TMP_Text redPlayersText;
    public TMP_Text bluePlayersText;
    public TMP_Text sessionNameText;

    public GameObject gameOverPanel;

    private GameState gameState;

    void Update()
    {
        if (gameState == null)
        {
            GameObject gameStateGO = GameObject.FindWithTag("GameController");
            if (gameStateGO != null)
            {
                gameState = gameStateGO.GetComponent<GameState>();
            }

            if (gameState == null)
            {
                return;
            }
        }

        if (CroquetBridge.Instance.croquetSessionState == "running")
        { // @@ provide static Croquet accessor
            string sessionNameValue = CroquetBridge.Instance.sessionName;
            SetSessionName(sessionNameValue);
        }
        UpdateScoresPlayers();

        if (gameState.gameEnded)
        {
            GameEnded();
        }
        else
        {
            gameOverPanel.SetActive(false);
        }
    }

    void SetSessionName(string sessionNameValue)
    {
        sessionNameText.text = "Session: " + $"{sessionNameValue}";
    }

    void UpdateScoresPlayers()
    {
        redScoreText.text = "Score: " + $"{gameState.redScore}";
        blueScoreText.text = "Score: " + $"{gameState.blueScore}";
        redPlayersText.text = "Players: " + $"{gameState.redPlayers}";
        bluePlayersText.text = "Players: " + $"{gameState.bluePlayers}";
    }

    void GameEnded()
    {
        gameOverPanel.SetActive(true);
    }
}
