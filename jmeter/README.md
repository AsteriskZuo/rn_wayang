# JMeter

JMeter test plans and related configuration for driving `measured_app` through `forward_server`.

- Required JMeter version: Apache JMeter 5.6.3.
- Test plans live in `data/`.

## Command-line verification

Prerequisites:

- `forward_server` is running and listening on `localhost:8083`.
- `measured_app` is running, has connected to the relay, and is ready to receive commands.
- Apache JMeter 5.6.3 is installed at `/Applications/apache-jmeter-5.6.3`.

Run one test plan and save full XML results, response data, and sampler data:

```sh
/Applications/apache-jmeter-5.6.3/bin/jmeter \
  -n \
  -t jmeter/data/rn-sdk-chat-client.jmx \
  -l /tmp/rn-sdk-chat-client.jtl \
  -j /tmp/rn-sdk-chat-client.log \
  -Jjmeter.save.saveservice.output_format=xml \
  -Jjmeter.save.saveservice.response_data=true \
  -Jjmeter.save.saveservice.samplerData=true
```

Run all current test plans one by one:

```sh
for f in jmeter/data/*.jmx; do
  name=$(basename "$f" .jmx)
  /Applications/apache-jmeter-5.6.3/bin/jmeter \
    -n \
    -t "$f" \
    -l "/tmp/${name}.jtl" \
    -j "/tmp/${name}.log" \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.response_data=true \
    -Jjmeter.save.saveservice.samplerData=true
done
```

Check for failed samples in the generated JTL files:

```sh
rg -n 's="false"|<failure>true' /tmp/rn-sdk-*.jtl
```

If the command prints no matches and each JMeter summary reports `Err: 0 (0.00%)`, the active samplers passed. Disabled samplers are not executed by these commands.
