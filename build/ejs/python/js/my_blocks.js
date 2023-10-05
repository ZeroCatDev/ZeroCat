'use strict';

/*
//前后
Blockly.Blocks.draw_move = {
    init: function() {
        var a = [["move forward by", "forward"], ["move backward by", "backward"]];
        this.setColour(160),
        this.appendValueInput("VALUE").setCheck("Number").appendField(new Blockly.FieldDropdown(a), "DIR"),
        this.setPreviousStatement(!0),
        this.setNextStatement(!0)
    }
},
Blockly.Python.draw_move = function(a) {
    Blockly.Python.definitions_.import_turtle = "import turtlexiangg\nturtle=turtle.Turtle()";
    var b = Blockly.Python.valueToCode(a, "VALUE", Blockly.Python.ORDER_NONE) || "0";
    return "turtle." + a.getFieldValue("DIR") + "(" + b + ")\n"
},

//方向
Blockly.Blocks.draw_turn = {
    init: function() {
        var a = [["turn right by", "right"], ["turn left by", "left"]];
        a[0][0] += " ↻",
        a[1][0] += " ↺",
        this.setColour(160),
        this.appendValueInput("VALUE").setCheck("Number").appendField(new Blockly.FieldDropdown(a), "DIR"),
        this.setPreviousStatement(!0),
        this.setNextStatement(!0)
    }
},
Blockly.Python.draw_turn = function(a) {
    Blockly.Python.definitions_.import_turtle = "import turtle\nturtle=turtle.Turtle()";
    var b = Blockly.Python.valueToCode(a, "VALUE", Blockly.Python.ORDER_NONE) || "0";
    return "turtle." + a.getFieldValue("DIR") + "(" + b + ")\n"
}
// import turtle\nturtle=turtle.Turtle();t = turtle.Turtle();t.forward(100);
*/

//注意这些代码是扣出来的，被压缩过

Blockly.Blocks.draw_move = {
    init: function() {
        var a = [["move forward by", "forward"], ["move backward by", "backward"]];
        this.setColour(160),
        this.appendValueInput("VALUE").setCheck("Number").appendField(new Blockly.FieldDropdown(a), "DIR"),
        this.setPreviousStatement(!0),
        this.setNextStatement(!0)
    }
},
Blockly.Python.draw_move = function(block) {
    Blockly.Python.definitions_.import_turtle = "import turtle\nturtle=turtle.Turtle()";
    var b = Blockly.Python.valueToCode(block, "VALUE", Blockly.Python.ORDER_NONE) || "0";
    return "turtle." + block.getFieldValue("DIR") + "(" + b + ")\n"
}
,
Blockly.Blocks.draw_turn = {
    init: function() {
        var a = [["turn right by", "right"], ["turn left by", "left"]];
        a[0][0] += " ↻",
        a[1][0] += " ↺",
        this.setColour(160),
        this.appendValueInput("VALUE").setCheck("Number").appendField(new Blockly.FieldDropdown(a), "DIR"),
        this.setPreviousStatement(!0),
        this.setNextStatement(!0)
    }
},
Blockly.Python.draw_turn = function(a) {
    Blockly.Python.definitions_.import_turtle = "import turtle\nturtle=turtle.Turtle()";
    var b = Blockly.Python.valueToCode(a, "VALUE", Blockly.Python.ORDER_NONE) || "0";
    return "turtle." + a.getFieldValue("DIR") + "(" + b + ")\n"
}
,
Blockly.Blocks.draw_shape = {
    init: function() {
        var a = [["shape turtle", "turtle"], ["shape circle", "circle"], ["shape classic", "classic"], ["shape square", "square"], ["shape triangle", "triangle"]];
        this.setColour(160),
        this.appendDummyInput().appendField(new Blockly.FieldDropdown(a), "SHAPE"),
        this.setPreviousStatement(!0),
        this.setNextStatement(!0)
    }
},
Blockly.Python.draw_shape = function(a) {
    return Blockly.Python.definitions_.import_turtle = "import turtle\nturtle=turtle.Turtle()",
    'turtle.shape("' + a.getFieldValue("SHAPE") + '")\n'
}
,
Blockly.Blocks.draw_pen = {
    init: function() {
        var a = [["pen up", "penup"], ["pen down", "pendown"]];
        this.setColour(160),
        this.appendDummyInput().appendField(new Blockly.FieldDropdown(a), "PEN"),
        this.setPreviousStatement(!0),
        this.setNextStatement(!0)
    }
},
Blockly.Python.draw_pen = function(a) {
    return Blockly.Python.definitions_.import_turtle = "import turtle\nturtle=turtle.Turtle()",
    "turtle." + a.getFieldValue("PEN") + "()\n"
}
,
Blockly.Blocks.draw_color = {
    init: function() {
        this.setColour(160),
        this.appendValueInput("COLOR").appendField("set color to"),
        this.setPreviousStatement(!0),
        this.setNextStatement(!0)
    }
},
Blockly.Python.draw_color = function(a) {
    Blockly.Python.definitions_.import_turtle = "import turtle\nturtle=turtle.Turtle()";
    var b = Blockly.Python.valueToCode(a, "COLOR", Blockly.Python.ORDER_NONE) || "#FFFFFF";
    return "turtle.color(" + b + ")\n"
}
,
Blockly.Blocks.draw_write = {
    init: function() {
        this.setColour(160),
        this.appendValueInput("STRING").appendField("write");
        var a = new Blockly.FieldTextInput("14",Blockly.FieldTextInput.nonnegativeIntegerValidator);
        this.appendDummyInput().appendField("font size").appendField(a, "FONTSIZE"),
        this.setPreviousStatement(!0),
        this.setNextStatement(!0)
    }
},
Blockly.Python.draw_write = function(a) {
    Blockly.Python.definitions_.import_turtle = "import turtle\nturtle=turtle.Turtle()";
    var b = Blockly.Python.valueToCode(a, "STRING", Blockly.Python.ORDER_NONE) || ""
      , c = a.getFieldValue("FONTSIZE");
    return "turtle.write(" + b + ', None, None, "' + c + 'pt normal")\n'
}
,
Blockly.Blocks.draw_circle = {
    init: function() {
        this.setColour(160),
        this.appendValueInput("VALUE").appendField("circle"),
        this.setPreviousStatement(!0),
        this.setNextStatement(!0)
    }
},
Blockly.Python.draw_circle = function(a) {
    Blockly.Python.definitions_.import_turtle = "import turtle\nturtle=turtle.Turtle()";
    var b = Blockly.Python.valueToCode(a, "VALUE", Blockly.Python.ORDER_NONE) || "50";
    return "turtle.circle(" + b + ")\n"
}
,
Blockly.Blocks.draw_stamp = {
    init: function() {
        this.setColour(160),
        this.appendDummyInput().appendField("stamp"),
        this.setPreviousStatement(!0),
        this.setNextStatement(!0)
    }
},
Blockly.Python.draw_stamp = function(a) {
    return Blockly.Python.definitions_.import_turtle = "import turtle\nturtle=turtle.Turtle()",
    "turtle.stamp()\n"
}
,
Blockly.Blocks.begin_fill = {
    init: function() {
        this.setColour(160),
        this.appendDummyInput().appendField("begin fill"),
        this.setPreviousStatement(!0),
        this.setNextStatement(!0)
    }
},
Blockly.Python.begin_fill = function(a) {
    return Blockly.Python.definitions_.import_turtle = "import turtle\nturtle=turtle.Turtle()",
    "turtle.begin_fill()\n"
}
,
Blockly.Blocks.end_fill = {
    init: function() {
        this.setColour(160),
        this.appendDummyInput().appendField("end fill"),
        this.setPreviousStatement(!0),
        this.setNextStatement(!0)
    }
},
Blockly.Python.end_fill = function(a) {
    return Blockly.Python.definitions_.import_turtle = "import turtle\nturtle=turtle.Turtle()",
    "turtle.end_fill()\n"
}
,
Blockly.Blocks["goto"] = {
    init: function() {
        this.setColour(160),
        this.appendDummyInput().appendField("goto"),
        this.appendValueInput("X"),
        this.appendValueInput("Y").appendField(","),
        this.setInputsInline(!0),
        this.setPreviousStatement(!0),
        this.setNextStatement(!0)
    }
},
Blockly.Python["goto"] = function(a) {
    Blockly.Python.definitions_.import_turtle = "import turtle\nturtle=turtle.Turtle()";
    var b = Blockly.Python.valueToCode(a, "X", Blockly.Python.ORDER_NONE) || "0"
      , c = Blockly.Python.valueToCode(a, "Y", Blockly.Python.ORDER_NONE) || "0";
    return "turtle.goto(" + b + "," + c + ")\n"
}
,
Blockly.Blocks.draw_speed = {
    init: function() {
        this.setColour(160),
        this.appendValueInput("VALUE").appendField("speed"),
        this.setPreviousStatement(!0),
        this.setNextStatement(!0)
    }
},
Blockly.Python.draw_speed = function(a) {
    Blockly.Python.definitions_.import_turtle = "import turtle\nturtle=turtle.Turtle()";
    var b = Blockly.Python.valueToCode(a, "VALUE", Blockly.Python.ORDER_NONE) || "50";
    return "turtle.speed(" + b + ")\n"
}
,
Blockly.Blocks.draw_pos = {
    init: function() {
        this.setColour(160),
        this.appendDummyInput().appendField("pos"),
        this.setOutput(!0)
    }
},
Blockly.Python.draw_pos = function(a) {
    Blockly.Python.definitions_.import_turtle = "import turtle\nturtle=turtle.Turtle()";
    return ["turtle.pos()", Blockly.Python.ORDER_ATOMIC]
}

/*
,
Blockly.Blocks.text_unicode = {
    init: function() {
        this.setHelpUrl(Blockly.Msg.TEXT_TEXT_HELPURL),
        this.setColour(160),
        this.appendDummyInput().appendField("unicode").appendField(this.newQuote_(!0)).appendField(new Blockly.FieldTextInput(""), "TEXT").appendField(this.newQuote_(!1)),
        this.setOutput(!0, "String"),
        this.setTooltip(Blockly.Msg.TEXT_TEXT_TOOLTIP)
    },
    newQuote_: function(a) {
        var b;
        return b = a == this.RTL ? "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAKCAQAAAAqJXdxAAAAqUlEQVQI1z3KvUpCcRiA8ef9E4JNHhI0aFEacm1o0BsI0Slx8wa8gLauoDnoBhq7DcfWhggONDmJJgqCPA7neJ7p934EOOKOnM8Q7PDElo/4x4lFb2DmuUjcUzS3URnGib9qaPNbuXvBO3sGPHJDRG6fGVdMSeWDP2q99FQdFrz26Gu5Tq7dFMzUvbXy8KXeAj57cOklgA+u1B5AoslLtGIHQMaCVnwDnADZIFIrXsoXrgAAAABJRU5ErkJggg==" : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAKCAQAAAAqJXdxAAAAn0lEQVQI1z3OMa5BURSF4f/cQhAKjUQhuQmFNwGJEUi0RKN5rU7FHKhpjEH3TEMtkdBSCY1EIv8r7nFX9e29V7EBAOvu7RPjwmWGH/VuF8CyN9/OAdvqIXYLvtRaNjx9mMTDyo+NjAN1HNcl9ZQ5oQMM3dgDUqDo1l8DzvwmtZN7mnD+PkmLa+4mhrxVA9fRowBWmVBhFy5gYEjKMfz9AylsaRRgGzvZAAAAAElFTkSuQmCC",
        new Blockly.FieldImage(b,12,12,'"')
    }
},
Blockly.Python.text_unicode = function(a) {
    var b = "u" + Blockly.Python.quote_(a.getFieldValue("TEXT"));
    return [b, Blockly.Python.ORDER_ATOMIC]
}
,
*/

//for plotting
/*
Blockly.Blocks.pyplot_plot = {
    init: function() {
        this.setColour(160),
        this.appendDummyInput().appendField("plot"),
        this.appendValueInput("X"),
        this.appendValueInput("Y").appendField(","),
        this.setInputsInline(!0),
        this.setPreviousStatement(!0),
        this.setNextStatement(!0)
    }
},
Blockly.Python.pyplot_plot = function(a) {
    Blockly.Python.definitions_.import_matplotlib_pyplot = "import matplotlib.pyplot";
    var b = Blockly.Python.valueToCode(a, "X", Blockly.Python.ORDER_NONE) || "0"
      , c = Blockly.Python.valueToCode(a, "Y", Blockly.Python.ORDER_NONE) || "0";
    return "matplotlib.pyplot.plot(" + b + "," + c + ")\n"
}
,
Blockly.Blocks.pyplot_show = {
    init: function() {
        this.setColour(160),
        this.appendDummyInput().appendField("show"),
        this.setPreviousStatement(!0),
        this.setNextStatement(!0)
    }
},
Blockly.Python.pyplot_show = function(a) {
    return Blockly.Python.definitions_.import_matplotlib_pyplot = "import matplotlib.pyplot",
    "matplotlib.pyplot.show()\n"
}
,
Blockly.Blocks.pyplot_title = {
    init: function() {
        this.setColour(160),
        this.appendValueInput("STRING").appendField("title"),
        this.setPreviousStatement(!0),
        this.setNextStatement(!0)
    }
},
Blockly.Python.pyplot_title = function(a) {
    Blockly.Python.definitions_.import_matplotlib_pyplot = "import matplotlib.pyplot";
    var b = Blockly.Python.valueToCode(a, "STRING", Blockly.Python.ORDER_NONE) || "";
    return "matplotlib.pyplot.title(" + b + ")\n"
}
,
Blockly.Blocks.pyplot_xlabel = {
    init: function() {
        this.setColour(160),
        this.appendValueInput("STRING").appendField("xlabel"),
        this.setPreviousStatement(!0),
        this.setNextStatement(!0)
    }
},
Blockly.Python.pyplot_xlabel = function(a) {
    Blockly.Python.definitions_.import_matplotlib_pyplot = "import matplotlib.pyplot";
    var b = Blockly.Python.valueToCode(a, "STRING", Blockly.Python.ORDER_NONE) || "";
    return "matplotlib.pyplot.xlabel(" + b + ")\n"
}
,
Blockly.Blocks.pyplot_ylabel = {
    init: function() {
        this.setColour(160),
        this.appendValueInput("STRING").appendField("ylabel"),
        this.setPreviousStatement(!0),
        this.setNextStatement(!0)
    }
},
Blockly.Python.pyplot_ylabel = function(a) {
    Blockly.Python.definitions_.import_matplotlib_pyplot = "import matplotlib.pyplot";
    var b = Blockly.Python.valueToCode(a, "STRING", Blockly.Python.ORDER_NONE) || "";
    return "matplotlib.pyplot.ylabel(" + b + ")\n"
}
,
Blockly.Blocks.numpy_linspace = {
    init: function() {
        this.setColour(160),
        this.appendValueInput("START").setAlign(Blockly.ALIGN_RIGHT).appendField("numpy.linspace").appendField("start"),
        this.appendValueInput("STOP").setAlign(Blockly.ALIGN_RIGHT).appendField("stop"),
        this.appendValueInput("VALUE").setCheck("Number").setAlign(Blockly.ALIGN_RIGHT).appendField("num"),
        this.setOutput(!0)
    }
},
Blockly.Python.numpy_linspace = function(a) {
    Blockly.Python.definitions_.import_numpy = "import numpy";
    var b = Blockly.Python.valueToCode(a, "START", Blockly.Python.ORDER_NONE) || "0"
      , c = Blockly.Python.valueToCode(a, "STOP", Blockly.Python.ORDER_NONE) || "0"
      , d = Blockly.Python.valueToCode(a, "VALUE", Blockly.Python.ORDER_NONE) || "50";
    return ["numpy.linspace(" + b + "," + c + "," + d + ")", Blockly.Python.ORDER_NONE]
}
,
Blockly.Blocks.numpy_array = {
    init: function() {
        this.setColour(160),
        this.appendValueInput("VALUE").setAlign(Blockly.ALIGN_RIGHT).appendField("numpy.array"),
        this.setOutput(!0)
    }
},
Blockly.Python.numpy_array = function(a) {
    Blockly.Python.definitions_.import_numpy = "import numpy";
    var b = Blockly.Python.valueToCode(a, "VALUE", Blockly.Python.ORDER_NONE) || "[]";
    return ["numpy.array(" + b + ")", Blockly.Python.ORDER_FUNCTION_CALL]
}
,
Blockly.Blocks.numpy_sin = {
    init: function() {
        this.setColour(160),
        this.appendValueInput("VALUE").setAlign(Blockly.ALIGN_RIGHT).appendField("numpy.sin"),
        this.setOutput(!0)
    }
},
Blockly.Python.numpy_sin = function(a) {
    Blockly.Python.definitions_.import_numpy = "import numpy";
    var b = Blockly.Python.valueToCode(a, "VALUE", Blockly.Python.ORDER_NONE) || "[]";
    return ["numpy.sin(" + b + ")", Blockly.Python.ORDER_FUNCTION_CALL]
}
,
Blockly.Blocks.numpy_cos = {
    init: function() {
        this.setColour(160),
        this.appendValueInput("VALUE").setAlign(Blockly.ALIGN_RIGHT).appendField("numpy.cos"),
        this.setOutput(!0)
    }
},
Blockly.Python.numpy_cos = function(a) {
    Blockly.Python.definitions_.import_numpy = "import numpy";
    var b = Blockly.Python.valueToCode(a, "VALUE", Blockly.Python.ORDER_NONE) || "[]";
    return ["numpy.cos(" + b + ")", Blockly.Python.ORDER_FUNCTION_CALL]
}
,
Blockly.Blocks.numpy_tan = {
    init: function() {
        this.setColour(160),
        this.appendValueInput("VALUE").setAlign(Blockly.ALIGN_RIGHT).appendField("numpy.tan"),
        this.setOutput(!0)
    }
},
Blockly.Python.numpy_tan = function(a) {
    Blockly.Python.definitions_.import_numpy = "import numpy";
    var b = Blockly.Python.valueToCode(a, "VALUE", Blockly.Python.ORDER_NONE) || "[]";
    return ["numpy.tan(" + b + ")", Blockly.Python.ORDER_FUNCTION_CALL]
}
,
Blockly.Blocks.numpy_exp = {
    init: function() {
        this.setColour(160),
        this.appendValueInput("VALUE").setAlign(Blockly.ALIGN_RIGHT).appendField("numpy.exp"),
        this.setOutput(!0)
    }
},
Blockly.Python.numpy_exp = function(a) {
    Blockly.Python.definitions_.import_numpy = "import numpy";
    var b = Blockly.Python.valueToCode(a, "VALUE", Blockly.Python.ORDER_NONE) || "[]";
    return ["numpy.exp(" + b + ")", Blockly.Python.ORDER_FUNCTION_CALL]
}
,
Blockly.Blocks.numpy_arange = {
    init: function() {
        this.setColour(160),
        this.appendValueInput("START").setCheck("Number").setAlign(Blockly.ALIGN_RIGHT).appendField("numpy.arange").appendField("start"),
        this.appendValueInput("STOP").setCheck("Number").setAlign(Blockly.ALIGN_RIGHT).appendField("stop"),
        this.appendValueInput("STEP").setCheck("Number").setAlign(Blockly.ALIGN_RIGHT).appendField("step"),
        this.setOutput(!0)
    }
},
Blockly.Python.numpy_arange = function(a) {
    Blockly.Python.definitions_.import_numpy = "import numpy";
    var b = Blockly.Python.valueToCode(a, "START", Blockly.Python.ORDER_NONE) || "0"
      , c = Blockly.Python.valueToCode(a, "STOP", Blockly.Python.ORDER_NONE) || "0"
      , d = Blockly.Python.valueToCode(a, "STEP", Blockly.Python.ORDER_NONE) || "1";
    return ["numpy.arange(" + b + "," + c + "," + d + ")", Blockly.Python.ORDER_NONE]
}
;
*/