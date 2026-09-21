# Contrat STT vers Conversation Live

Version : 1.0
Date : 2026-09-21
Statut : Actif

## 1. Les 4 etats de reponse

### CORRECT (score >= 85%)
- Feedback positif
- Navigation vers nextNodeOnSuccess
- Progression enregistree

### ACCEPTABLE (70% <= score < 85%)
- Feedback encourageant
- Navigation vers nextNodeOnSuccess
- Progression enregistree

### INCORRECT (score < 70%)
- Feedback correctif
- RETRY automatique (meme noeud, max 3 essais)
- Apres 3 essais : nextNodeOnFail

### UNKNOWN (erreur technique)
- Message d'erreur
- Bouton Reessayer
- Pas de progression

## 2. Interface STTManager

Objet retourne :
- state : CORRECT | ACCEPTABLE | INCORRECT | UNKNOWN
- score : 0 a 100
- feedback : string
- transcript : string
- isSimulation : boolean

## 3. Logique de decision

Si pas de transcript : UNKNOWN
Si score >= 85 : CORRECT
Si score >= 70 : ACCEPTABLE
Sinon : INCORRECT

## 4. Comportement du moteur

### CORRECT et ACCEPTABLE
- Feedback positif ou encourageant
- scheduleTransition(nextNodeOnSuccess)

### INCORRECT
- Incrementer attempts[node.id]
- Si attempts < 3 : retry meme noeud
- Si attempts >= 3 : scheduleTransition(nextNodeOnFail)

### UNKNOWN
- Afficher erreur technique
- Activer bouton Reessayer
- Pas de progression

## 5. Regles importantes

1. Le moteur doit utiliser le resultat de validation,
   pas seulement la presence de nextNodeOnSuccess.
2. Wrong answer doit toujours mener a feedback puis retry.
3. Jamais de blocage : si nextNodeOnFail absent,
   utiliser node.nextNode ou rester sur le meme noeud.
4. sttEnabled = false signifie vraie simulation sans micro.

## 6. Fichiers concernes

- src/core/stt-manager.js : evaluateResponse()
- src/app.js : handleUserResponse() et handleSTTResponse()
- content/fr/conversations/*.json : nextNodeOnFail a ajouter
