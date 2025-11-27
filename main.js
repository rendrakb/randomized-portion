const CONFIG = {
  DATA: {
    MIN_TOTAL: 100,
    MAX_TOTAL: 1000,
    STEP: 100,
    MIN_PERCENT: 10,
    MAX_PERCENT: 300,
    PERCENT_STEP: 10,
  },
  COLORS: {
    CORRECT: "lightgreen",
    INCORRECT: "red",
  },
};

const state = {
  itemData: null,
  questionTemplates: [],
  currentQuestion: null,
  currentAnswer: null,
  pageStartTime: Date.now(),
  lastSubmitTime: null,
  correctCount: 0,
  totalAttempts: 0,
  currentQuestionSubmitted: false,
};

class ItemDataManager {
  constructor() {
    this.data = null;
  }

  randomize() {
    let A, B, BPercent, C, D, CDiff, total;
    let attempts = 0;
    const maxAttempts = 200;
    let validData = false;
    
    while (!validData && attempts < maxAttempts) {
      // Generate A in steps of 100 (between 100-400 for safety)
      A = (Math.floor(Math.random() * 4) + 1) * CONFIG.DATA.STEP;
      
      // Generate B as percentage of A (in steps of 10%, can exceed 100%)
      BPercent = (Math.floor(Math.random() * 15) + 1) * CONFIG.DATA.PERCENT_STEP;
      B = Math.round((BPercent / 100) * A);
      
      // Generate total in steps of 100, ensuring enough room for C and D
      const minTotalSteps = Math.ceil((A + B + 300) / CONFIG.DATA.STEP);
      const maxTotalSteps = 10;
      
      if (minTotalSteps > maxTotalSteps) {
        attempts++;
        continue;
      }
      
      const totalSteps = Math.floor(Math.random() * (maxTotalSteps - minTotalSteps + 1)) + minTotalSteps;
      total = totalSteps * CONFIG.DATA.STEP;
      
      // Calculate remaining value after A and B
      const remaining = total - A - B;
      
      if (remaining < 300) {
        attempts++;
        continue;
      }
      
      // Generate a random difference with more variety
      // Use a random value between 10 and 80% of remaining, in steps of 10
      const minDiff = 10;
      const maxDiffPercent = 80;
      const diffPercent = (Math.floor(Math.random() * (maxDiffPercent - minDiff) / 10) + minDiff / 10) * 10;
      CDiff = Math.round((diffPercent / 100) * remaining);
      
      // Ensure CDiff is at least 50 for meaningful difference
      if (CDiff < 50) {
        CDiff = 50 + Math.floor(Math.random() * 10) * 10;
      }
      
      // Randomly decide if C is more or less than D
      const CIsMore = Math.random() < 0.5;
      
      if (CIsMore) {
        // C is more than D by CDiff
        D = (remaining - CDiff) / 2;
        C = (remaining + CDiff) / 2;
      } else {
        // C is less than D by CDiff
        C = (remaining - CDiff) / 2;
        D = (remaining + CDiff) / 2;
        CDiff = -CDiff; // Make it negative to indicate direction
      }
      
      // Round values
      C = Math.round(C);
      D = Math.round(D);
      
      // Verify all values are positive and meaningful
      if (C > 50 && D > 50 && Math.abs(C - D) >= 50 && Math.abs((A + B + C + D) - total) < 2) {
        validData = true;
      }
      
      attempts++;
    }
    
    // If we couldn't find a valid combination, use a guaranteed valid approach
    if (!validData) {
      A = 200;
      BPercent = 50;
      B = 100;
      total = 900;
      C = 350;
      D = 250;
      CDiff = 100;
    }

    this.data = {
      total: total,
      A: A,
      B: B,
      BPercent: BPercent,
      C: C,
      D: D,
      CDiff: Math.abs(CDiff),
      CDirection: CDiff > 0 ? "more than" : "less than",
    };

    return this.data;
  }

  getData() {
    return this.data;
  }

  getValue(item) {
    if (!this.data) return 0;
    return this.data[item];
  }
}

class ItemRenderer {
  constructor() {
    this.containers = {
      total: document.getElementById("total-item"),
      itemA: document.getElementById("item-a"),
      itemB: document.getElementById("item-b"),
      itemC: document.getElementById("item-c"),
      itemD: document.getElementById("item-d"),
    };
  }

  render(data) {
    if (!data) return;

    this.containers.total.innerHTML = `The total value of all items is <strong>${data.total}</strong>`;
    this.containers.itemA.innerHTML = `A is <strong>${data.A}</strong>`;
    this.containers.itemB.innerHTML = `B is <strong>${data.BPercent}%</strong> of A`;
    this.containers.itemC.innerHTML = `C is <strong>${Math.abs(data.CDiff)}</strong> ${data.CDirection} D`;
    this.containers.itemD.innerHTML = `D is <strong>unknown</strong>`;
  }
}

class QuestionGenerator {
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  static pickRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  generateVariables(variableNames) {
    const vars = {};
    const items = ["A", "B", "C", "D"];

    variableNames.forEach((varName) => {
      if (varName === "item") {
        vars[varName] = QuestionGenerator.pickRandom(items);
      } else if (varName === "itemA") {
        vars[varName] = QuestionGenerator.pickRandom(items);
      } else if (varName === "itemB") {
        // Make sure itemB is different from itemA if itemA exists
        const availableItems = vars.itemA 
          ? items.filter(item => item !== vars.itemA)
          : items;
        vars[varName] = QuestionGenerator.pickRandom(availableItems);
      }
    });

    return vars;
  }

  calculateAnswer(type, vars) {
    const data = this.dataManager.getData();
    if (!data) return null;

    switch (type) {
      case "percentContribution":
        return this.calculatePercentContribution(vars, data);

      case "itemValue":
        return this.getItemValue(vars, data);

      case "sumOfItems":
        return this.calculateSumOfItems(vars, data);

      case "largestItem":
        return this.findLargestItem(data);

      case "smallestItem":
        return this.findSmallestItem(data);

      case "percentOfTotal":
        return this.calculatePercentOfTotal(vars, data);

      case "compareItems":
        return this.compareItems(vars, data);

      case "differenceItems":
        return this.calculateDifference(vars, data);

      default:
        console.warn(`Unknown question type: ${type}`);
        return null;
    }
  }

  calculatePercentContribution(vars, data) {
    const item = vars.item;
    const itemValue = data[item];
    const total = data.total;

    if (total === 0) return "0%";

    const percentage = (itemValue / total) * 100;
    return `${Math.round(percentage)}%`;
  }

  getItemValue(vars, data) {
    const item = vars.item;
    return Math.round(data[item]);
  }

  calculateSumOfItems(vars, data) {
    const itemA = vars.itemA;
    const itemB = vars.itemB;
    const sum = data[itemA] + data[itemB];
    return Math.round(sum);
  }

  findLargestItem(data) {
    const items = { A: data.A, B: data.B, C: data.C, D: data.D };
    let maxItem = "A";
    let maxValue = data.A;

    Object.entries(items).forEach(([item, value]) => {
      if (value > maxValue) {
        maxValue = value;
        maxItem = item;
      }
    });

    return maxItem;
  }

  findSmallestItem(data) {
    const items = { A: data.A, B: data.B, C: data.C, D: data.D };
    let minItem = "A";
    let minValue = data.A;

    Object.entries(items).forEach(([item, value]) => {
      if (value < minValue) {
        minValue = value;
        minItem = item;
      }
    });

    return minItem;
  }

  calculatePercentOfTotal(vars, data) {
    const item = vars.item;
    const itemValue = data[item];
    const total = data.total;

    if (total === 0) return "0%";

    const percentage = (itemValue / total) * 100;
    return `${Math.round(percentage)}%`;
  }

  compareItems(vars, data) {
    const itemA = vars.itemA;
    const itemB = vars.itemB;
    const valueA = data[itemA];
    const valueB = data[itemB];

    return valueA > valueB ? itemA : itemB;
  }

  calculateDifference(vars, data) {
    const itemA = vars.itemA;
    const itemB = vars.itemB;
    const diff = data[itemA] - data[itemB];
    return Math.round(diff);
  }

  generate() {
    if (!state.questionTemplates.length || !this.dataManager.getData()) {
      console.warn("Cannot generate question: missing templates or data");
      return null;
    }

    const template = QuestionGenerator.pickRandom(state.questionTemplates);
    const variables = this.generateVariables(template.variables);
    const answer = this.calculateAnswer(template.type, variables);

    let questionText = template.template;
    Object.entries(variables).forEach(([key, value]) => {
      questionText = questionText.replace(`{${key}}`, value);
    });

    state.currentQuestion = questionText;
    state.currentAnswer = answer;

    return { question: questionText, answer };
  }
}

class UIController {
  constructor() {
    this.elements = {
      questionDisplay: document.querySelector(".questions"),
      answerInput: document.getElementById("answerInput"),
      feedback: document.getElementById("feedback"),
      answerDiv: null,
      score: document.getElementById("score"),
      lastTime: document.getElementById("last-time"),
      totalTime: document.getElementById("total-time"),
    };
  }

  displayQuestion(question, answer) {
    this.elements.questionDisplay.innerHTML = `
      <strong>${question}</strong><br>
      <div id="answer" style="display:none;">Answer: ${answer}</div>
    `;
    this.clearInput();
    this.clearFeedback();
    this.updateAnswerElement();
  }

  updateAnswerElement() {
    this.elements.answerDiv = document.getElementById("answer");
  }

  clearInput() {
    this.elements.answerInput.value = "";
  }

  clearFeedback() {
    this.elements.feedback.textContent = "";
    this.elements.feedback.style.color = "";
  }

  showAnswer() {
    if (this.elements.answerDiv) {
      this.elements.answerDiv.style.display = "block";
    }
  }

  showFeedback(isCorrect) {
    this.elements.feedback.textContent = isCorrect ? "Correct." : "Wrong";
    this.elements.feedback.style.color = isCorrect
      ? CONFIG.COLORS.CORRECT
      : CONFIG.COLORS.INCORRECT;
  }

  updateScore() {
    this.elements.score.textContent = `Score: ${state.correctCount}/${state.totalAttempts}`;
  }

  updateLastTime(seconds) {
    this.elements.lastTime.textContent = `Last time spent: ${this.formatTime(
      seconds
    )}`;
  }

  updateTotalTime() {
    const totalSeconds = (Date.now() - state.pageStartTime) / 1000;
    this.elements.totalTime.textContent = `Total time spent: ${this.formatTime(
      totalSeconds
    )}`;
  }

  formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(
      2,
      "0"
    )}`;
  }

  getUserAnswer() {
    return this.elements.answerInput.value;
  }
}

class AnswerValidator {
  static normalize(answer) {
    if (answer == null) return "";

    let normalized = String(answer).trim().toLowerCase();
    normalized = normalized.replace(/,/g, "");

    const num = parseFloat(normalized.replace("%", ""));
    if (!isNaN(num)) {
      const hasPercent = String(answer).includes("%");
      if (hasPercent) {
        return `${Math.abs(Math.round(num))}%`;
      } else {
        return Math.round(num);
      }
    }

    return normalized;
  }

  static isCorrect(userAnswer, correctAnswer) {
    const normalizedUser = this.normalize(userAnswer);
    const normalizedCorrect = this.normalize(correctAnswer);
    return normalizedUser == normalizedCorrect;
  }
}

class QuizApp {
  constructor() {
    this.dataManager = new ItemDataManager();
    this.itemRenderer = new ItemRenderer();
    this.questionGenerator = new QuestionGenerator(this.dataManager);
    this.uiController = new UIController();
    this.initialize();
  }

  async initialize() {
    await this.loadQuestionTemplates();
    this.setupEventListeners();
    this.startTimers();
    this.initializeItemsAndQuestion();
  }

  async loadQuestionTemplates() {
    try {
      const response = await fetch("q.json");
      state.questionTemplates = await response.json();
    } catch (error) {
      console.error("Error loading q.json:", error);
      alert("Could not load q.json.");
    }
  }

  setupEventListeners() {
    document
      .getElementById("questionButton")
      .addEventListener("click", () => this.generateNewQuestion());

    document
      .getElementById("answerButton")
      .addEventListener("click", () => this.uiController.showAnswer());

    document
      .getElementById("randomizeButton")
      .addEventListener("click", () => this.handleRandomize());

    document
      .getElementById("submitAnswerButton")
      .addEventListener("click", () => this.handleSubmit());

    this.uiController.elements.answerInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.handleSubmit();
    });
  }

  startTimers() {
    setInterval(() => this.uiController.updateTotalTime(), 1000);
  }

  initializeItemsAndQuestion() {
    this.randomizeItems();
    this.generateNewQuestion();
  }

  randomizeItems() {
    const data = this.dataManager.randomize();
    state.itemData = data;
    this.itemRenderer.render(data);
  }

  generateNewQuestion() {
    const result = this.questionGenerator.generate();
    if (result) {
      this.uiController.displayQuestion(result.question, result.answer);
      state.currentQuestionSubmitted = false;
    }
  }

  handleRandomize() {
    this.randomizeItems();
    this.generateNewQuestion();
  }

  handleSubmit() {
    if (state.currentQuestionSubmitted) return;

    const userAnswer = this.uiController.getUserAnswer();
    const isCorrect = AnswerValidator.isCorrect(
      userAnswer,
      state.currentAnswer
    );

    state.totalAttempts++;
    if (isCorrect) state.correctCount++;

    this.uiController.updateScore();
    this.uiController.showFeedback(isCorrect);

    const now = Date.now();
    if (state.lastSubmitTime) {
      const elapsedSeconds = (now - state.lastSubmitTime) / 1000;
      this.uiController.updateLastTime(elapsedSeconds);
    }
    state.lastSubmitTime = now;

    state.currentQuestionSubmitted = true;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new QuizApp());
} else {
  new QuizApp();
}