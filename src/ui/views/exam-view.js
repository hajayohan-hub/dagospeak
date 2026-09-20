/**
 * DagoSpeak V5.102 - Vue Examen A0→A1
 * 
 * Examen de certification : 30 questions, 30 minutes, seuil 70%
 * Pool : 253 questions équilibrées entre les 25 thèmes A0
 */

export function renderExam() {
  const main = document.getElementById('app');
  
  // Charger les données d'examen
  fetch('/content/fr/exams.json')
    .then(response => response.json())
    .then(examsData => {
      const exam = examsData.exams.find(e => e.id === 'exam_a0_a1');
      
      if (!exam) {
        main.innerHTML = `
          <div style="max-width: 600px; margin: 2rem auto; padding: 2rem; text-align: center;">
            <h1>❌ Examen non trouvé</h1>
            <p>L'examen A0→A1 n'est pas configuré.</p>
            <button onclick="router.navigate('/themes')" style="margin-top: 1rem; padding: 0.75rem 1.5rem;">
              Retour aux thèmes
            </button>
          </div>
        `;
        return;
      }
      
      // Générer les questions depuis le pool
      const questions = generateExamQuestions(exam);
      
      main.innerHTML = `
        <div style="max-width: 800px; margin: 0 auto; padding: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h1 style="margin: 0;">${exam.title}</h1>
            <div style="font-size: 1.5rem; font-weight: bold; color: var(--ds-color-accent);">
              <span id="timer">30:00</span>
            </div>
          </div>
          
          <div style="background: var(--ds-color-surface); padding: 1.5rem; border-radius: var(--ds-radius-lg); margin-bottom: 2rem;">
            <p style="margin: 0 0 1rem 0; color: var(--ds-color-text-muted);">
              ${exam.description}
            </p>
            <div style="display: flex; gap: 2rem; font-size: 0.9rem;">
              <div><strong>Questions :</strong> ${exam.questionCount}</div>
              <div><strong>Durée :</strong> ${exam.duration} minutes</div>
              <div><strong>Seuil :</strong> ${exam.passingScore}%</div>
            </div>
          </div>
          
          <div id="exam-questions"></div>
          
          <div style="margin-top: 2rem; text-align: center;">
            <button id="submit-exam" style="padding: 1rem 2rem; font-size: 1.1rem; background: var(--ds-color-primary); color: white; border: none; border-radius: var(--ds-radius-md); cursor: pointer;">
              Soumettre l'examen
            </button>
          </div>
        </div>
      `;
      
      renderQuestions(questions);
      startTimer(exam.duration);
      
      document.getElementById('submit-exam').addEventListener('click', () => {
        submitExam(questions, exam);
      });
    })
    .catch(error => {
      console.error('Erreur chargement examen:', error);
      main.innerHTML = `
        <div style="max-width: 600px; margin: 2rem auto; padding: 2rem; text-align: center;">
          <h1>❌ Erreur</h1>
          <p>Impossible de charger l'examen.</p>
          <button onclick="router.navigate('/themes')" style="margin-top: 1rem; padding: 0.75rem 1.5rem;">
            Retour aux thèmes
          </button>
        </div>
      `;
    });
}

function generateExamQuestions(exam) {
  // TODO: Implémenter la génération équilibrée depuis le pool de 253 questions
  // Pour l'instant, retourner un placeholder
  console.warn('[Exam] generateExamQuestions non implémenté - utilisation de questions de test');
  
  return [
    {
      id: 'q1',
      theme: 'greetings',
      questionFr: 'Comment dit-on "Bonjour" ?',
      options: ['Manahoana', 'Veloma', 'Misaotra', 'Azafady'],
      correctAnswer: 0
    },
    {
      id: 'q2',
      theme: 'family',
      questionFr: 'Comment dit-on "père" ?',
      options: ['Reny', 'Dada', 'Rahalahy', 'Anabavy'],
      correctAnswer: 1
    }
    // ... ajouter plus de questions
  ];
}

function renderQuestions(questions) {
  const container = document.getElementById('exam-questions');
  
  questions.forEach((q, index) => {
    const questionHtml = `
      <div style="background: var(--ds-color-surface); padding: 1.5rem; border-radius: var(--ds-radius-md); margin-bottom: 1.5rem;">
        <h3 style="margin: 0 0 1rem 0;">Question ${index + 1}</h3>
        <p style="font-size: 1.1rem; margin-bottom: 1rem;">${q.questionFr}</p>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${q.options.map((opt, i) => `
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input type="radio" name="q${index}" value="${i}" />
              <span>${opt}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
    container.innerHTML += questionHtml;
  });
}

function startTimer(minutes) {
  let timeLeft = minutes * 60;
  const timerEl = document.getElementById('timer');
  
  const interval = setInterval(() => {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    
    if (timeLeft <= 0) {
      clearInterval(interval);
      alert('Temps écoulé !');
      // TODO: Soumettre automatiquement
    }
    
    timeLeft--;
  }, 1000);
}

function submitExam(questions, exam) {
  // Calculer le score
  let correctCount = 0;
  
  questions.forEach((q, index) => {
    const selected = document.querySelector(`input[name="q${index}"]:checked`);
    if (selected && parseInt(selected.value) === q.correctAnswer) {
      correctCount++;
    }
  });
  
  const score = Math.round((correctCount / questions.length) * 100);
  const passed = score >= exam.passingScore;
  
  // Afficher le résultat
  const main = document.getElementById('app');
  main.innerHTML = `
    <div style="max-width: 600px; margin: 2rem auto; padding: 2rem; text-align: center;">
      <h1>${passed ? '🎉 Félicitations !' : '😔 Pas encore...'}</h1>
      <div style="font-size: 3rem; margin: 2rem 0; font-weight: bold; color: ${passed ? 'var(--ds-color-success)' : 'var(--ds-color-accent)'};">
        ${score}%
      </div>
      <p style="font-size: 1.1rem; margin-bottom: 2rem;">
        ${correctCount}/${questions.length} réponses correctes
      </p>
      <p style="color: var(--ds-color-text-muted); margin-bottom: 2rem;">
        ${passed 
          ? 'Vous avez réussi l\'examen A0→A1 ! Le niveau A1 est maintenant débloqué.' 
          : `Il vous faut au moins ${exam.passingScore}% pour réussir. Continuez à pratiquer !`
        }
      </p>
      <button onclick="router.navigate('/themes')" style="padding: 1rem 2rem; font-size: 1.1rem; background: var(--ds-color-primary); color: white; border: none; border-radius: var(--ds-radius-md); cursor: pointer;">
        Retour aux thèmes
      </button>
    </div>
  `;
  
  // TODO: Sauvegarder le résultat et débloquer A1 si réussi
  if (passed) {
    localStorage.setItem('dagospeak:a1_unlocked', 'true');
  }
}
