function timer({lengthSeconds = 2147483, onStart = () => {}, onEnd = () => {}} = {}) {
        let lastRunMillis, startedAtMillis, id;
        let counter = 0;
        let remainingSeconds = lengthSeconds;

        function onEndWrapper() {
            counter++;
            id = undefined;
            onEnd();
        }

        function run() {
            lastRunMillis = performance.now();
            id = setTimeout(onEndWrapper, remainingSeconds * 1000);
        }

        return {
            start() {
                onStart();
                startedAtMillis = performance.now();
                run(); 
            },
            pause() {
                id = clearTimeout(id);
                remainingSeconds -= (performance.now() - lastRunMillis) / 1000;
            },
            end() { 
                this.reset();
                onEndWrapper(); 
            },
            resume() { run(); },
            reset() { 
                id = clearTimeout(id); 
                counter = 0;
                remainingSeconds = lengthSeconds;
            },
            setLength(newLengthSeconds) {
                id = clearTimeout(id);
                lengthSeconds = newLengthSeconds;
                remainingSeconds = lengthSeconds;
            },
            restart() {
                id = clearTimeout(id);
                remainingSeconds = lengthSeconds;
                this.start();
            },
            counter() { return counter; }, // TODO: Kalle denne phase, og så la den være 0 før det starter, og så øke til 1 ved start. Da blir det mer sekvensielle faser
            value() { // TODO: value fortsetter å gå når man pauser
                const relativeAge = (performance.now() - startedAtMillis) / lengthSeconds / 1000;
                return clamp(relativeAge, 0, 1); 
            },
            running() { return !!id; },
            elapsedSeconds() {
                if (!startedAtMillis) return 0;
                if (id) {
                    return (performance.now() - startedAtMillis) / 1000;
                } else {
                    return lengthSeconds - remainingSeconds;
                }
            },
        };
    }