export default {
  "python": {
    name: "Python(3.11)",
    extension: "py",
    command: "asdf shell python latest:3.11\n(stty -echo; echo {code} | base64 -d > main.py; echo -e \"\\033[2J\\033[H\"; stty echo)\npython main.py",
    icon: "mdi-language-python",
    placeholder: "# Enter Python code here",
    sample: "print('Hello from Python!')\nfor i in range(5):\n    print(f'Count: {i}')"
  },
  "python-2.7": {
    name: "Python2.7",
    extension: "py",
    command: "asdf shell python latest:2.7\n(stty -echo; echo {code} | base64 -d > main.py; echo -e \"\\033[2J\\033[H\"; stty echo)\npython main.py",
    icon: "mdi-language-python",
    placeholder: "# Enter Python code here",
    sample: "print('Hello from Python!')\nfor i in range(5):\n    print('Count: ' + str(i))"
  },
  "python-3.11": {
    name: "Python3.11",
    extension: "py",
    command: "asdf shell python latest:3.11\n(stty -echo; echo {code} | base64 -d > main.py; echo -e \"\\033[2J\\033[H\"; stty echo)\npython main.py",
    icon: "mdi-language-python",
    placeholder: "# Enter Python code here",
    sample: "print('Hello from Python!')\nfor i in range(5):\n    print(f'Count: {i}')"
  },
  "python-3.12": {
    name: "Python3.12",
    extension: "py",
    command: "asdf shell python latest:3.12\n(stty -echo; echo {code} | base64 -d > main.py; echo -e \"\\033[2J\\033[H\"; stty echo)\npython main.py",
    icon: "mdi-language-python",
    placeholder: "# Enter Python code here",
    sample: "print('Hello from Python!')\nfor i in range(5):\n    print(f'Count: {i}')"
  },
  "python-3.13": {
    name: "Python3.13",
    extension: "py",
    command: "asdf shell python latest:3.13\n(stty -echo; echo {code} | base64 -d > main.py; echo -e \"\\033[2J\\033[H\"; stty echo)\npython main.py",
    icon: "mdi-language-python",
    placeholder: "# Enter Python code here",
    sample: "print('Hello from Python!')\nfor i in range(5):\n    print(f'Count: {i}')"
  },

  "javascript": {
    name: "JavaScript(NodeJS22)",
    extension: "js",
    command: "asdf shell nodejs latest:22\n(stty -echo; echo {code} | base64 -d > main.js; echo -e \"\\033[2J\\033[H\"; stty echo)\nnode main.js",
    icon: "mdi-nodejs",
    placeholder: "// Enter JavaScript code here",
    sample: "console.log('Hello from JavaScript!');\nfor(let i = 0; i < 5; i++) {\n    console.log(`Count: ${i}`);\n}"
  },
  "javascript-nodejs18": {
    name: "JavaScript(NodeJS18)",
    extension: "js",
    command: "asdf shell nodejs latest:18\n(stty -echo; echo {code} | base64 -d > main.js; echo -e \"\\033[2J\\033[H\"; stty echo)\nnode main.js",
    icon: "mdi-nodejs",
    placeholder: "// Enter JavaScript code here",
    sample: "console.log('Hello from JavaScript!');\nfor(let i = 0; i < 5; i++) {\n    console.log(`Count: ${i}`);\n}"
  },
  "javascript-nodejs20": {
    name: "JavaScript(NodeJS20)",
    extension: "js",
    command: "asdf shell nodejs latest:20\n(stty -echo; echo {code} | base64 -d > main.js; echo -e \"\\033[2J\\033[H\"; stty echo)\nnode main.js",
    icon: "mdi-nodejs",
    placeholder: "// Enter JavaScript code here",
    sample: "console.log('Hello from JavaScript!');\nfor(let i = 0; i < 5; i++) {\n    console.log(`Count: ${i}`);\n}"
  },
  "javascript-nodejs22": {
    name: "JavaScript(NodeJS22)",
    extension: "js",
    command: "asdf shell nodejs latest:22\n(stty -echo; echo {code} | base64 -d > main.js; echo -e \"\\033[2J\\033[H\"; stty echo)\nnode main.js",
    icon: "mdi-nodejs",
    placeholder: "// Enter JavaScript code here",
    sample: "console.log('Hello from JavaScript!');\nfor(let i = 0; i < 5; i++) {\n    console.log(`Count: ${i}`);\n}"
  },
  "javascript-nodejs24": {
    name: "JavaScript(NodeJS24)",
    extension: "js",
    command: "asdf shell nodejs latest:24\n(stty -echo; echo {code} | base64 -d > main.js; echo -e \"\\033[2J\\033[H\"; stty echo)\nnode main.js",
    icon: "mdi-nodejs",
    placeholder: "// Enter JavaScript code here",
    sample: "console.log('Hello from JavaScript!');\nfor(let i = 0; i < 5; i++) {\n    console.log(`Count: ${i}`);\n}"
  },
  "rust": {
    name: "Rust",
    extension: "rs",
    command: "asdf shell rust latest\n(stty -echo; echo {code} | base64 -d > main.rs; echo -e \"\\033[2J\\033[H\"; stty echo)\nrustc main.rs && ./main",
    icon: "mdi-language-rust",
    placeholder: "// Enter Rust code here",
    sample: "fn main() {\n    println!(\"Hello from Rust!\");\n    for i in 0..5 {\n        println!(\"Count: {}\", i);\n    }\n}"
  },
  "golang": {
    name: "Golang",
    extension: "go",
    command: "asdf shell golang latest\n(stty -echo; echo {code} | base64 -d > main.go; echo -e \"\\033[2J\\033[H\"; stty echo)\nCGO_ENABLED=0 GOMAXPROCS=2 GOGC=50 go run -gcflags='-N -l' main.go",
    icon: "mdi-language-go",
    placeholder: "// Enter Golang code here",
    sample: "package main\n\nimport \"fmt\"\n\nfunc main() {\n    fmt.Println(\"Hello from Golang!\")\n    for i := 0; i < 5; i++ {\n        fmt.Printf(\"Count: %d\\n\", i)\n    }\n}"
  },
  "ruby": {
    name: "Ruby",
    extension: "rb",
    command: "asdf shell ruby latest\n(stty -echo; echo {code} | base64 -d > main.rb; echo -e \"\\033[2J\\033[H\"; stty echo)\nruby main.rb",
    icon: "mdi-language-ruby",
    placeholder: "# Enter Ruby code here",
    sample: "puts 'Hello, World!'"
  },
  "java": {
    name: "Java(openjdk-24)",
    extension: "java",
    command: "asdf shell java openjdk-24\n(stty -echo; echo {code} | base64 -d > main.java; echo -e \"\\033[2J\\033[H\"; stty echo)\njavac main.java\njava main",
    icon: "mdi-language-java",
    placeholder: "// Enter Java code here",
    sample: "class main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, World!\");\n    }\n}"
  },
  "java-openjdk21": {
    name: "Java(openjdk-21)",
    extension: "java",
    command: "asdf shell java openjdk-21\n(stty -echo; echo {code} | base64 -d > main.java; echo -e \"\\033[2J\\033[H\"; stty echo)\njavac main.java\njava main",
    icon: "mdi-language-java",
    placeholder: "// Enter Java code here",
    sample: "class main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, World!\");\n    }\n}"
  },
  "java-openjdk17": {
    name: "Java(openjdk-17)",
    extension: "java",
    command: "asdf shell java openjdk-17\n(stty -echo; echo {code} | base64 -d > main.java; echo -e \"\\033[2J\\033[H\"; stty echo)\njavac main.java\njava main",
    icon: "mdi-language-java",
    placeholder: "// Enter Java code here",
    sample: "class main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, World!\");\n    }\n}"
  },
  "java-openjdk24": {
    name: "Java(openjdk-24)",
    extension: "java",
    command: "asdf shell java openjdk-24\n(stty -echo; echo {code} | base64 -d > main.java; echo -e \"\\033[2J\\033[H\"; stty echo)\njavac main.java\njava main",
    icon: "mdi-language-java",
    placeholder: "// Enter Java code here",
    sample: "class main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, World!\");\n    }\n}"
  },

}
