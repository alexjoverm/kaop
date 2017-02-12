var http = require("http");
var emitter = new(class Emitter extends require("events") {});
var assert = require("assert");
var main = require("../index.js");
var klass = main.klass;
var aspects = main.aspects;
var Phase = main.Phase;

var Person;
var Programmer;
var CoolProgrammer;
var DataParser;

var normalPerson;
var normalProgrammer;
var coolProgrammer;

aspects.locals.http = http;
aspects.locals.aux = [];

aspects.push(
    Phase.INSTANCE,
    function executeWhenCreated() {
        setTimeout(this[meta.methodName], 200);
    }
);

aspects.push(
    Phase.EXECUTE,
    function xhrGet(host) {
        http.get({
            host: host
        }, function(res) {
            var body;
            res.on("data", function(d) {
                body = body + d;
            });
            res.on("end", function() {
                meta.args.unshift(body);
                next();
            });
        });
    },
    function log() {
        aux.push("logged");
    },
    function processResponse() {
        meta.args[0] = "something";
    },
    function executeFn(fnName) {
        meta.scope[fnName]();
    },
    function jsonStringify(param) {
        meta.args[param] = JSON.stringify(meta.args[param]);
    },
    function appendResult() {
        meta.result.push("append...");
    }
);

Person = klass({
    constructor: function(name, dborn) {
        this.name = name;
        this.dborn = dborn;
    },
    run: function() {
        return "Im running!";
    },
    getAge: function() {
        var currentYear = new Date()
            .getFullYear();
        var yearBorn = this.dborn.getFullYear();
        return currentYear - yearBorn;
    }
});

Programmer = klass.inherits(Person, {
    constructor: ["override", function(parent, name, dborn, favouriteLanguage) {
        parent(name, dborn);
        this.favLang = favouriteLanguage;
    }],
    run: ["override", function(parent) {
        return parent() + " but... not as faster, coz im fat :/";
    }],
    code: function() {
        return "Im codding in " + this.favLang;
    }
});

CoolProgrammer = klass.inherits(Programmer, {
    constructor: ["override", function(parent, name, dborn, favouriteLanguage) {
        parent(name, dborn, favouriteLanguage);
    }],
    run: function() {
        return "IM FAST AS HELL!! GET OUT OF MY WAY!";
    }
});

describe("functional testing 1", function() {
    beforeAll(function() {
        normalPerson = new Person("Tom", new Date(1978, 4, 11));
    });

    it("Person instance should have all klass methods", function() {
        assert.strictEqual("Tom", normalPerson.name);
        assert.equal(39, normalPerson.getAge());
        assert.equal("Im running!", normalPerson.run());
    });
});

describe("functional testing 2", function() {

    beforeAll(function() {
        normalPerson = new Person("Joe", new Date(1990, 2, 21));
        normalProgrammer = new Programmer("Mike", new Date(1982, 7, 18), "Java");
        coolProgrammer = new CoolProgrammer("Ivan", new Date(1990, 8, 22), "Javascript");
    });

    it("klass instances should be objects with defined properties", function() {
        assert.equal("Joe", normalPerson.name);
        assert.equal("Mike", normalProgrammer.name);
        assert.equal("Ivan", coolProgrammer.name);

        assert.notEqual("C#", coolProgrammer.favLang);
    });

    it("inner instances should inherit superClass properties", function() {
        assert.equal(27, normalPerson.getAge());
        assert.notEqual(27, normalProgrammer.getAge());
        assert.equal(27, coolProgrammer.getAge());

        assert.throws(function() {
            normalPerson.code();
        }, Error);

        assert.notEqual("Im codding in Java", coolProgrammer.code());
        assert.equal("Im codding in Java", normalProgrammer.code());
    });

    it("instance methods should point to its scope, no mather how they get called", function() {
        var tmpFunction = function(exec) {
            return exec();
        };

        assert.equal(27, tmpFunction(normalPerson.getAge));
        assert.equal(27, tmpFunction(coolProgrammer.getAge));
        assert.equal(35, tmpFunction(normalProgrammer.getAge));
    });


    it("built in annotation override should import parent method as first argument", function() {
        assert.equal("Im running!", normalPerson.run());
        assert.equal("Im running! but... not as faster, coz im fat :/", normalProgrammer.run());
        assert.equal("IM FAST AS HELL!! GET OUT OF MY WAY!", coolProgrammer.run());
    });
});

describe("create a new annotation that parses the first parameter that method receives", function() {

    it("annotation functions can receive parameters to change their behavior", function() {
        DataParser = klass.statik({
            serialize: ["jsonStringify: 0", function(serializedObject) {
                return serializedObject;
            }]
        });

        var o = {
            some: 1,
            data: {
                a: "test"
            },
            asd: [{
                y: 6
            }, {
                y: "asdasd"
            }, {
                y: 5
            }]
        };

        assert.strictEqual('{"some":1,"data":{"a":"test"},"asd":[{"y":6},{"y":"asdasd"},{"y":5}]}', DataParser.serialize(o));
    });
    it("aspects can run in background", function(done) {
        DataParser = klass.statik({
            ping: ["xhrGet: 'google.es'", function(response) {
                done();
            }]
        });
        DataParser.ping();
    });

});

describe("extending JS native types", function() {
    var List, listInstance;
    beforeAll(function() {
        List = klass.inherits(Array, {
            constructor: ["override", function(parent) {
                parent();
            }],
            has: function(val) {
                return this.indexOf(val) > -1;
            }
        });
        listInstance = new List();
    });

    it("List should inherit Array properties", function() {
        listInstance.push(3);
        listInstance.push(1);
        listInstance.push(5);
        var result = listInstance.reduce(function(a, b) {
            return a + b;
        });
        assert.strictEqual(result, 9);
    });
    it("List should contain a new method called `has`", function() {
        assert(listInstance.has(3));
        assert(!listInstance.has(454));
    });
});

describe("aspects could be placed anywhere in the array definition", function() {
    var Service;
    beforeAll(function() {
        Service = klass.statik({
            operation1: ["log", function() {
                aspects.locals.aux.push("operation1");
            }],
            operation2: [function() {
                aspects.locals.aux.push("operation2");
            }, "log"]
        });
    });

    it("should check if aspects are executed given own position", function() {

        Service.operation1();
        Service.operation2();

        assert.strictEqual(aspects.locals.aux.join(","), "logged,operation1,operation2,logged");
    });
});

describe.skip("Hooks `first` and `last`, flow control", function() {

    var Service;
    beforeAll(function() {
        Service = klass.statik({
            myMethod: ["tryReferenceError", function(fnName) {
                function aFunctionWhoDoesNothing() {}
                return eval(fnName + "()");
            }, "appendResult"]
        });
    });

    it("::myMethod will trigger an exception, should be captured", function() {
        assert.strictEqual(Service.myMethod("kajsdasdasdsadh").join(","), "error,append...,lastExecution");
    });
    it("::myMethod will not trigger any exception", function() {
        assert.strictEqual(Service.myMethod("aFunctionWhoDoesNothing").join(","), ",append...,lastExecution");
    });
});

describe("multiple async operations", function() {
    it("should get google response and then asign to a new variable", function(done) {
        var MyService = klass.statik({
            asyncOperation: ["xhrGet: 'google.es'", "processResponse", function(response) {
                if (response === "something") {
                    this.fn = done;
                }
            }, "executeFn: 'fn'"]
        });

        MyService.asyncOperation();

    });
});

describe("intro to instance phase aspects", function() {
    var myDummyClass;
    beforeAll(function() {
        DummyClass = klass({
            constructor: function(callback) {
                this.endThisTest = callback;
            },
            handle: ["executeWhenCreated", function() {
                this.endThisTest();
            }]
        });
    });

    it("should able to see their own context in instantiate  phase", function(done) {
        new DummyClass(done);
    });
});
